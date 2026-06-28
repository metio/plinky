// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { Cursor, OpenSheetMusicDisplay } from "opensheetmusicdisplay";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { useMidiConnection, useMidiInput } from "../contexts/midi";
import { useFullscreen } from "../hooks/useFullscreen";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { useMetronome } from "../hooks/useMetronome";
import { type CorrectInfo, type Hand, useScoreMatcher } from "../hooks/useScoreMatcher";
import { useSynth } from "../hooks/useSynth";
import { summarizeDynamics } from "../lib/dynamics";
import { annotateFingerings } from "../lib/fingerScore";
import { computeFlow } from "../lib/flow";
import { recordDailyDone } from "../lib/dailyStreak";
import { recordPractice } from "../lib/history";
import { computeGrade, GRADE_COLOR, type Grade } from "../lib/grade";
import { nextKeyboardWindow, type Span } from "../lib/keyboardWindow";
import { recordRun } from "../lib/lifetime";
import {
    applyRun,
    isDue,
    letterMin,
    loadMastery,
    markLearned,
    type Mastery,
    saveMastery,
    setBacklog,
} from "../lib/mastery";
import { BARS_PER_ROW, KEYBOARD_OCTAVES, loadPrefs, savePrefs } from "../lib/prefs";
import { loadSongFingering } from "../lib/savedFingering";
import { decodeGhost, encodeGhost, ghostReached, loadGhost, saveGhost } from "../lib/recording";
import { SITE_URL } from "../lib/site";
import { makeHit, summarize } from "../lib/rhythm";
import {
    collectNoteElements,
    GHOST_COLOR,
    NOTE_COLOR,
    paintElement,
    paintPlayedNotes,
    PLAYED_COLOR,
} from "../lib/scoreColor";
import { buildMidiFile, type MidiNote } from "../lib/midiFile";
import { buildPrintDocument, fileStem } from "../lib/printScore";
import { type Grid, gridFor, type RunNote } from "../lib/shareCard";
import { transposeMusicXml } from "../lib/transpose";
import {
    findHotspots,
    type Hotspot,
    instantaneousBpm,
    median,
    type TempoPoint,
    tempoSeries,
} from "../lib/tempo";
import { m } from "../paraglide/messages.js";
import { localizeHref } from "../paraglide/runtime.js";
import { Bpm } from "./bpm";
import { FocusStrip } from "./focusStrip";
import { GhostTrack } from "./ghostTrack";
import {
    DownloadIcon,
    MaximizeIcon,
    MinimizeIcon,
    PlayIcon,
    PrinterIcon,
    ShareIcon,
    StopIcon,
} from "./icons";
import { PerformanceStrip } from "./performanceStrip";
import { PianoKeyboard } from "./pianoKeyboard";
import { ShareCard } from "./shareCard";
import { TempoGraph } from "./tempoGraph";

// A cleared note plus the velocity it was played at — the run's raw record, from
// which the grade, the per-note strip and the share grid are all derived.
type PlayedNote = RunNote & { velocity: number };

const BUTTON =
    "rounded-md bg-indigo-50 px-3 py-1.5 text-sm font-medium text-indigo-700 hover:bg-indigo-100 disabled:opacity-50 dark:bg-indigo-950 dark:text-indigo-300";
// A button carrying an icon and a label, and one carrying only an icon (square).
const BUTTON_WITH_ICON = `${BUTTON} inline-flex items-center gap-1.5`;
const ICON_BUTTON =
    "rounded-md bg-indigo-50 p-2 text-indigo-700 hover:bg-indigo-100 disabled:opacity-50 dark:bg-indigo-950 dark:text-indigo-300";

const NUMBER_INPUT =
    "w-14 rounded-md border border-gray-300 bg-transparent px-2 py-1 text-sm tabular-nums text-gray-700 dark:border-gray-700 dark:text-gray-300";

// Renders a MusicXML score with OpenSheetMusicDisplay. Listen plays it back on the
// shared synth, walking OSMD's cursor so the highlight follows; Practice turns the
// same cursor into a note-by-note matcher driven by MIDI or the keyboard. OSMD
// needs a real DOM and is large, so it loads and renders on the client only.
export function ScoreViewer({
    id,
    xml,
    title,
    onMastery,
    daily,
    ephemeral,
    initialTempo,
    beatsPerBar,
    lockTempo,
    canShareGhost,
}: {
    id: string;
    xml: string;
    title: string;
    onMastery?: () => void;
    // The piece's own tempo, used as the starting point for Listen and the count —
    // the component is keyed by piece, so it re-seeds when the piece changes.
    initialTempo?: number;
    // The piece's beats per bar, so the metronome accents the downbeat.
    beatsPerBar?: number;
    // Fix the tempo at initialTempo and hide the slider, so a shared challenge is
    // played at one tempo by everyone rather than dialled to taste.
    lockTempo?: boolean;
    // When set, this run is the day's shared challenge; the share card identifies
    // it as "Plinky #N" rather than by the piece, so everyone compares one grid.
    daily?: number;
    // A throwaway piece, like a freshly generated sprint, that still counts toward
    // the streak and fingerprint but is never tracked for spaced repetition.
    ephemeral?: boolean;
    // Bundled pieces have a stable id every player shares, so their ghost can be
    // sent to a friend by link and loaded back via a ?ghost= code.
    canShareGhost?: boolean;
}) {
    const containerRef = useRef<HTMLDivElement>(null);
    const rootRef = useRef<HTMLDivElement>(null);
    const osmdRef = useRef<OpenSheetMusicDisplay | null>(null);
    const timers = useRef<number[]>([]);
    // Tracks playback synchronously, so a second click that lands before the
    // `playing` state has re-rendered can't start a second cursor loop.
    const playingRef = useRef(false);
    const tempoRef = useRef(initialTempo ?? 100);
    const notesRef = useRef<PlayedNote[]>([]);
    const startRef = useRef(0);
    const baseOffsetRef = useRef(0);
    const synth = useSynth();
    const [ready, setReady] = useState(false);
    const [loadError, setLoadError] = useState(false);
    const [playing, setPlaying] = useState(false);
    const [metronomeOn, setMetronomeOn] = useState(false);
    // How finely the metronome divides each beat: 1 = beats, 2 = eighths, 3 =
    // triplets, 4 = sixteenths.
    const [subdivision, setSubdivision] = useState(1);
    // An adaptive metronome follows the player's own tempo, read live from their
    // note timing, instead of ticking at the fixed slider speed.
    const [adaptive, setAdaptive] = useState(false);
    const [liveTempo, setLiveTempo] = useState(initialTempo ?? 100);
    const [tempo, setTempo] = useState(initialTempo ?? 100);
    // The tempo trainer ramps the tempo up by a step after each completed run, up to
    // a target — practising a piece from comfortable to performance speed. Read from
    // a ref at run-end so a completion handler created earlier sees the live setting.
    const [trainerOn, setTrainerOn] = useState(false);
    const [trainerTarget, setTrainerTarget] = useState(140);
    const trainerRef = useRef({ on: false, target: 140 });
    trainerRef.current = { on: trainerOn, target: trainerTarget };
    // Stable so the completion effect can depend on it without re-running; it reads
    // the trainer setting from a ref, so an empty dependency list is correct.
    const bumpTempo = useCallback(() => {
        if (trainerRef.current.on) {
            setTempo((current) => Math.min(current + 5, trainerRef.current.target));
        }
    }, []);
    // Section looping: Listen repeats a bar range over and over so a hard passage
    // can be drilled — read along, or play along with the metronome. Bars are
    // 1-based for the player; the cursor walks them 0-based, hence the offset in
    // listen(). The range is read from a ref during playback so the loop reacts to
    // the inputs without restarting the cursor loop.
    const [measureCount, setMeasureCount] = useState(1);
    const [loopOn, setLoopOn] = useState(false);
    const [loopFrom, setLoopFrom] = useState(1);
    const [loopTo, setLoopTo] = useState(1);
    const loopRef = useRef({ on: false, from: 1, to: 1 });
    loopRef.current = { on: loopOn, from: loopFrom, to: loopTo };
    // Transposition shifts the whole piece into a more comfortable key, ±12
    // semitones. It rewrites the MusicXML before OSMD loads it, so playback, the
    // printed key and the matcher all follow — the reload effect depends on it.
    const [transpose, setTranspose] = useState(0);
    // The fingering the player worked out for this piece (Fingering mode). When they
    // have some, the staff can show theirs instead of the app's suggestion — defaulting
    // to theirs, since they chose it on purpose.
    const saved = useMemo(() => loadSongFingering(id), [id]);
    const hasSaved = Object.keys(saved).length > 0;
    const [showMine, setShowMine] = useState(hasSaved);
    // Bars forced onto each staff row (0 = fit to width), remembered per device.
    const [barsPerRow, setBarsPerRow] = useState(() => loadPrefs().barsPerRow);
    // A phone-sized viewport — narrow (portrait) OR short (landscape, where the width
    // alone would read as desktop). Drives the focus strip and a shorter staff box so the
    // keyboard never buries the notes, in either orientation.
    const narrowOrShort = useMediaQuery("(max-width: 639px), (max-height: 600px)");
    const portrait = useMediaQuery("(orientation: portrait)");
    const coarsePointer = useMediaQuery("(pointer: coarse)");
    // A "play full screen" mode that strips everything down to one score and the keys.
    const { fullscreen, enter: enterFullscreen, exit: exitFullscreen } = useFullscreen(rootRef);
    const compact = narrowOrShort || fullscreen;
    // In full screen the keyboard can be folded away, handing all the height to the
    // score — what a player on a real MIDI piano wants.
    const [hideKeyboard, setHideKeyboard] = useState(false);
    // The slice of keyboard on show. A wide-ranging piece would shrink every key to a
    // sliver if framed whole, so the keyboard tracks a bounded window that follows the
    // notes being played; the player picks its width (or 0 to keep the whole piece in
    // view, fixed). Changing it re-frames from scratch (clear the remembered window).
    const [keyWindow, setKeyWindow] = useState<Span | null>(null);
    const [keyboardOctaves, setKeyboardOctaves] = useState(() => loadPrefs().keyboardOctaves);
    const keyboardSpan = keyboardOctaves === 0 ? Number.POSITIVE_INFINITY : keyboardOctaves * 12;
    // A once-dismissible nudge to turn a touch phone sideways for a wider keyboard, only
    // when it would actually help (portrait, no MIDI). Read after mount to avoid a
    // hydration mismatch; the portrait layout stays fully usable, so this never forces
    // an orientation (WCAG 1.3.4).
    const [rotateDismissed, setRotateDismissed] = useState(false);
    useEffect(() => {
        setRotateDismissed(localStorage.getItem("plinky:rotate-hint") === "dismissed");
    }, []);
    // The notation the mobile focus strip shows — transposed to match what's played,
    // but un-annotated (it's for reading the bar, not the printed fingering).
    const focusXml = useMemo(
        () => (transpose === 0 ? xml : transposeMusicXml(xml, transpose)),
        [xml, transpose],
    );
    // Which hand to practice, and the score's staff count — the hands-separate
    // selector only appears for the grand-staff (two-staff) scores it applies to.
    const [hand, setHand] = useState<Hand>("both");
    const [staffCount, setStaffCount] = useState(1);
    // A previous completed run on this score to race against — the note onset times
    // — and how far that ghost has reached as the current run's clock elapses.
    const [ghost, setGhost] = useState<number[] | null>(null);
    const [ghostDone, setGhostDone] = useState(0);
    // The rendered note groups per step, captured when a race starts, and which
    // step currently wears the ghost's colour — so the marker can move along the
    // staff and be restored as it leaves each note.
    const ghostNotesRef = useRef<SVGGElement[][]>([]);
    const ghostMarkRef = useRef(-1);
    // The ghost saved for this score (own last run, or a friend's loaded by link) —
    // the source for the share link. Mirrors storage so the share button reacts.
    const [storedGhost, setStoredGhost] = useState<number[] | null>(null);
    const [sharedFromLink, setSharedFromLink] = useState(false);
    const [shareStatus, setShareStatus] = useState<"idle" | "copied">("idle");

    // A metronome on demand: fixed at the chosen tempo, or following the player's
    // own pace when adaptive.
    useMetronome(metronomeOn, adaptive ? liveTempo : tempo, beatsPerBar ?? 4, subdivision);
    const [grade, setGrade] = useState<Grade | null>(null);
    const [runNotes, setRunNotes] = useState<RunNote[]>([]);
    const [shareGrid, setShareGrid] = useState<Grid | null>(null);
    const [dailyStreak, setDailyStreak] = useState(0);
    const [tempoCurve, setTempoCurve] = useState<{
        points: TempoPoint[];
        median: number;
        hotspots: Hotspot[];
    } | null>(null);
    const [mastery, setMastery] = useState<Mastery | null>(null);
    // The tempo a run was matched at, captured when practice starts so the run's
    // self-paced tempo curve reads against the same reference the matcher used,
    // even if the slider is moved afterwards.
    const runTempoRef = useRef(initialTempo ?? 100);
    // Whether any note has been coloured on the score, so a fresh run re-renders to
    // clear last run's progress only when there is something to clear.
    const paintedRef = useRef(false);

    useEffect(() => {
        setMastery(ephemeral ? null : loadMastery(id));
    }, [id, ephemeral]);

    const [searchParams] = useSearchParams();
    // Adopt a ghost handed over by a ?ghost= link so the player can race a friend's
    // run; otherwise the score's own stored ghost is the one to race and to re-share.
    useEffect(() => {
        if (!canShareGhost) {
            setStoredGhost(null);
            return;
        }
        const shared = decodeGhost(searchParams.get("ghost") ?? "");
        if (shared) {
            saveGhost(id, shared);
            setStoredGhost(shared);
            setSharedFromLink(true);
        } else {
            setStoredGhost(loadGhost(id));
            setSharedFromLink(false);
        }
    }, [id, canShareGhost, searchParams]);

    // Keep-going mode, remembered across pieces; captured by the matcher at run start.
    const [forgiving, setForgiving] = useState(() => loadPrefs().forgiving);
    const matcher = useScoreMatcher(() => osmdRef.current, {
        tempo,
        hand,
        forgiving,
        onCorrect: (info: CorrectInfo) => {
            for (const pitch of info.pitches) {
                synth.playNote(pitch);
            }
            // Colour the notes just cleared — the cursor is still on them, as it
            // only advances after this callback — so the score shows progress.
            const osmd = osmdRef.current;
            if (osmd) {
                paintPlayedNotes(osmd, info.pitches);
                paintedRef.current = true;
            }
            // Record each note's notated time (the ideal) and when it was actually
            // played, both relative to the first note, for the grade, the per-note
            // strip and the share grid.
            if (info.ordinal === 0) {
                startRef.current = info.timestamp;
                baseOffsetRef.current = info.timeMs;
            }
            notesRef.current = [
                ...notesRef.current,
                {
                    targetMs: info.timeMs - baseOffsetRef.current,
                    playedMs: info.timestamp - startRef.current,
                    wrongBefore: info.wrongBefore,
                    velocity: info.velocity,
                },
            ];
            // Track the player's tempo from the gap to the previous note and ease
            // the adaptive metronome toward it, so a single rushed note nudges
            // rather than jerks the pulse. Clamped to the slider's own range.
            const played = notesRef.current;
            if (played.length >= 2) {
                const a = played[played.length - 2];
                const b = played[played.length - 1];
                if (a && b) {
                    const inst = instantaneousBpm(
                        runTempoRef.current,
                        b.targetMs - a.targetMs,
                        b.playedMs - a.playedMs,
                    );
                    if (inst > 0 && Number.isFinite(inst)) {
                        setLiveTempo((prev) =>
                            Math.round(Math.min(180, Math.max(40, prev * 0.6 + inst * 0.4))),
                        );
                    }
                }
            }
        },
    });
    useMidiInput({
        onNoteOn: (event) => matcher.registerNote(event.note, event.timestamp, event.velocity),
    });
    const { support, status, devices, requestAccess } = useMidiConnection();
    const connected = status === "ready" && devices.length > 0;

    // Slide the keyboard window to keep the notes being played in view, re-framing only
    // when they leave it. Falls back to the whole range (null window) when not practising,
    // where PianoKeyboard's own default applies.
    useEffect(() => {
        setKeyWindow((prev) =>
            nextKeyboardWindow(prev, matcher.range, matcher.expected, keyboardSpan),
        );
    }, [matcher.range, matcher.expected, keyboardSpan]);

    useEffect(() => {
        tempoRef.current = tempo;
    }, [tempo]);

    // Advance the ghost on the live clock while practicing — it starts with the
    // player's first note (startRef), so the two race from the same moment.
    useEffect(() => {
        if (!matcher.practicing || !ghost) {
            return;
        }
        const tick = () => {
            if (startRef.current > 0) {
                setGhostDone(ghostReached(ghost, performance.now() - startRef.current));
            }
        };
        const timer = window.setInterval(tick, 50);
        return () => window.clearInterval(timer);
    }, [matcher.practicing, ghost]);

    // Move the ghost's colour onto the note it has currently reached, restoring the
    // one it leaves to green if the player has already played it there, else black.
    // Captured note groups outlive a render, so this paints the real staff.
    useEffect(() => {
        const steps = ghostNotesRef.current;
        if (steps.length === 0) {
            return;
        }
        const restore = (step: number) => {
            const base = matcher.done > step ? PLAYED_COLOR : NOTE_COLOR;
            for (const element of steps[step] ?? []) {
                paintElement(element, base);
            }
        };
        const previous = ghostMarkRef.current;
        // Off the staff once the race is over or paused.
        if (!ghost || !matcher.practicing || matcher.complete) {
            if (previous >= 0) {
                restore(previous);
                ghostMarkRef.current = -1;
            }
            return;
        }
        const target = Math.min(ghostDone, steps.length - 1);
        if (target === previous) {
            return;
        }
        if (previous >= 0) {
            restore(previous);
        }
        for (const element of steps[target] ?? []) {
            paintElement(element, GHOST_COLOR);
        }
        ghostMarkRef.current = target;
    }, [ghostDone, ghost, matcher.practicing, matcher.complete, matcher.done]);

    // Grade a run once it completes, from the captured timing and velocity. A run
    // with no real velocity variation (the computer keyboard) is graded without
    // dynamics rather than crediting a constant.
    useEffect(() => {
        if (!matcher.complete) {
            return;
        }
        const notes = notesRef.current;
        const velocities = notes.map((note) => note.velocity);
        const hasDynamics = new Set(velocities).size > 1;
        const hits = notes.map((note, index) => makeHit(index, note.playedMs - note.targetMs));
        const result = computeGrade({
            correct: matcher.total,
            wrong: matcher.wrong,
            rhythm: summarize(hits),
            flow: computeFlow(notes),
            dynamics: hasDynamics ? summarizeDynamics(velocities) : null,
        });
        setGrade(result);
        setRunNotes(notes);
        setShareGrid(gridFor(notes));
        // A finished run nudges the tempo trainer up for the next attempt.
        bumpTempo();
        // Read the player's own tempo back out of the gaps between their notes, so
        // the results show where they sped up or dragged against their own pace.
        const points = tempoSeries(
            runTempoRef.current,
            notes.map((note) => note.targetMs),
            notes.map((note) => note.playedMs),
        );
        const med = median(points.map((point) => point.bpm));
        setTempoCurve(
            points.length > 0 ? { points, median: med, hotspots: findHotspots(points, med) } : null,
        );
        // Fold the run's core trio into the lifetime fingerprint shown on /progress.
        recordRun({ accuracy: result.accuracy, timing: result.timing, flow: result.flow });
        // A finished daily extends the Wordle-style daily streak (before the practice
        // record fires PRACTICE_EVENT, so listeners read the updated streak).
        if (daily != null) {
            setDailyStreak(recordDailyDone(daily).streak);
        }
        // Count the run's notes toward the practice streak.
        recordPractice(matcher.total);
        if (ephemeral) {
            return;
        }
        // Keep the run as this score's ghost to race (and share) next time.
        const onsets = notes.map((note) => note.playedMs);
        saveGhost(id, onsets);
        setStoredGhost(onsets);
        setSharedFromLink(false);
        // Fold the run into spaced-repetition state: a score that clears the
        // threshold becomes learned and schedules (or reschedules) its review.
        const threshold = letterMin(loadPrefs().masteryThreshold);
        const updated = applyRun(loadMastery(id), result.score, threshold, Date.now());
        saveMastery(id, updated);
        setMastery(updated);
        onMastery?.();
    }, [
        matcher.complete,
        matcher.total,
        matcher.wrong,
        id,
        onMastery,
        ephemeral,
        daily,
        bumpTempo,
    ]);

    const markLearnedNow = () => {
        const updated = markLearned(loadMastery(id), Date.now());
        saveMastery(id, updated);
        setMastery(updated);
        onMastery?.();
    };
    const toggleBacklog = () => {
        const current = loadMastery(id);
        const updated = setBacklog(current, !current?.backlog, Date.now());
        saveMastery(id, updated);
        setMastery(updated);
        onMastery?.();
    };

    // Hand the score's ghost to a friend as a link they open to race it.
    const shareGhost = async () => {
        if (!storedGhost) {
            return;
        }
        const url = `${SITE_URL}${localizeHref(`/play/${id}`)}?ghost=${encodeGhost(storedGhost)}`;
        try {
            if (typeof navigator.share === "function") {
                await navigator.share({ url, text: m.ghost_share_boast({ title }) });
            } else {
                await navigator.clipboard?.writeText(url);
                setShareStatus("copied");
            }
        } catch {
            // A cancelled share or a blocked clipboard needs no message.
        }
    };

    // Open the rendered staff alone in a print window — the browser's print dialog
    // then prints it or saves it as a PDF, free of the app's controls and chrome.
    const printScore = () => {
        const svg = containerRef.current?.querySelector("svg");
        if (!svg) {
            return;
        }
        const win = window.open("", "_blank");
        if (!win) {
            return;
        }
        win.document.write(buildPrintDocument(svg.outerHTML, title));
        win.document.close();
        win.focus();
        win.print();
    };

    // Walk the cursor once to read the piece's notes — the same model Listen plays,
    // so the export carries whatever is on screen, transposition included — and save
    // them as a Standard MIDI File at the current tempo.
    const exportMidi = () => {
        const osmd = osmdRef.current;
        if (!osmd) {
            return;
        }
        const cursor = osmd.cursor;
        const wasVisible = playingRef.current || matcher.practicing;
        cursor.reset();
        const notes: MidiNote[] = [];
        let position = 0;
        while (!cursor.iterator.EndReached) {
            let beats = 1;
            for (const note of cursor.NotesUnderCursor()) {
                const quarters = note.Length.RealValue * 4;
                if (!note.isRest() && note.halfTone > 0) {
                    notes.push({
                        midi: note.halfTone + 12,
                        startQuarters: position,
                        durationQuarters: quarters,
                    });
                }
                beats = Math.max(beats, quarters);
            }
            cursor.next();
            position += beats;
        }
        cursor.reset();
        // Reading the score nudged the cursor; hide it again unless a run owns it.
        if (!wasVisible) {
            cursor.hide();
        }
        const blob = new Blob([buildMidiFile(notes, { tempo })], { type: "audio/midi" });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = `${fileStem(title)}.mid`;
        anchor.click();
        URL.revokeObjectURL(url);
    };

    const stopListen = () => {
        for (const id of timers.current) {
            window.clearTimeout(id);
        }
        timers.current = [];
        if (!matcher.practicing) {
            osmdRef.current?.cursor?.hide();
        }
        playingRef.current = false;
        setPlaying(false);
    };

    // Reload OSMD whenever the score changes, and stop any playback/practice.
    // biome-ignore lint/correctness/useExhaustiveDependencies: matcher.stop/stopListen reset transient playback, not render inputs
    useEffect(() => {
        let cancelled = false;
        setReady(false);
        setLoadError(false);
        paintedRef.current = false;
        stopListen();
        matcher.stop();
        import("opensheetmusicdisplay")
            .then(({ OpenSheetMusicDisplay }) => {
                if (cancelled || !containerRef.current) {
                    return;
                }
                const osmd = new OpenSheetMusicDisplay(containerRef.current, {
                    autoResize: true,
                    drawingParameters: "compact",
                    // Scroll the staff to keep the cursor in view as it advances, so a
                    // multi-line piece follows along while you play instead of forcing
                    // you to scroll — critical on a phone where the staff is tall.
                    followCursor: true,
                });
                osmdRef.current = osmd;
                // Force a fixed number of bars per row when the player picks one, for
                // bigger, more readable notation on a small screen; 0 fits them to width.
                (
                    osmd as unknown as { rules: { RenderXMeasuresPerLineAkaSystem: number } }
                ).rules.RenderXMeasuresPerLineAkaSystem = barsPerRow;
                // Print suggested fingering on the staff, personalised to the
                // player's reach, unless they've turned hints off — so the suggestion
                // sits on the note being read, not mapped onto a key.
                // Transpose first, then annotate, so the printed fingering is
                // computed for the key actually being played.
                const transposed = transpose === 0 ? xml : transposeMusicXml(xml, transpose);
                const source = loadPrefs().showFingerings
                    ? annotateFingerings(
                          transposed,
                          loadPrefs().handSpan,
                          showMine ? saved : undefined,
                      )
                    : transposed;
                return osmd.load(source).then(() => {
                    if (!cancelled) {
                        osmd.render();
                        // A grand staff (two staves) can be drilled one hand at a
                        // time; a single-staff score offers no such choice.
                        setStaffCount(osmd.Sheet?.getCompleteNumberOfStaves() ?? 1);
                        setHand("both");
                        // Seed the loop range to the whole piece so the inputs are
                        // valid before the player narrows them to a passage.
                        const bars = osmd.Sheet?.SourceMeasures?.length ?? 1;
                        setMeasureCount(bars);
                        setLoopFrom(1);
                        setLoopTo(bars);
                        setLoopOn(false);
                        setReady(true);
                    }
                });
            })
            // A failed chunk import or MusicXML that OSMD can't load would otherwise
            // leave ready false forever — a silently dead viewer with disabled
            // controls and no explanation. Surface it instead.
            .catch(() => {
                if (!cancelled) {
                    setLoadError(true);
                }
            });
        return () => {
            cancelled = true;
            for (const id of timers.current) {
                window.clearTimeout(id);
            }
        };
    }, [xml, transpose, showMine, saved, barsPerRow]);

    // Walk the cursor one voice-entry at a time, sounding the notes under it and
    // waiting their notated duration at the chosen tempo.
    const listen = () => {
        const osmd = osmdRef.current;
        if (!osmd || playingRef.current) {
            return;
        }
        playingRef.current = true;
        matcher.stop();
        const cursor: Cursor = osmd.cursor;
        // Walk the cursor to the first voice-entry of a 1-based bar from a clean
        // reset — OSMD has no direct seek, so the range loop steps to it.
        const seekToBar = (bar: number) => {
            cursor.reset();
            while (!cursor.iterator.EndReached && cursor.iterator.CurrentMeasureIndex < bar - 1) {
                cursor.next();
            }
        };
        if (loopRef.current.on) {
            seekToBar(loopRef.current.from);
        } else {
            cursor.reset();
        }
        cursor.show();
        setPlaying(true);
        const tick = () => {
            const loop = loopRef.current;
            // Past the loop's last bar (or the score's end while looping), jump back
            // to the start bar rather than stopping — and ramp the tempo if the
            // trainer is on, so each pass drills the passage a little faster.
            if (
                loop.on &&
                (cursor.iterator.EndReached || cursor.iterator.CurrentMeasureIndex > loop.to - 1)
            ) {
                bumpTempo();
                seekToBar(loop.from);
            } else if (cursor.iterator.EndReached) {
                stopListen();
                bumpTempo();
                return;
            }
            let beats = 1;
            for (const note of cursor.NotesUnderCursor()) {
                const quarters = note.Length.RealValue * 4;
                if (!note.isRest() && note.halfTone > 0) {
                    synth.playNote(note.halfTone + 12, { duration: quarters });
                }
                beats = Math.max(beats, quarters);
            }
            cursor.next();
            timers.current.push(window.setTimeout(tick, beats * (60000 / tempoRef.current)));
        };
        tick();
    };

    const practice = () => {
        stopListen();
        notesRef.current = [];
        setGrade(null);
        setRunNotes([]);
        setShareGrid(null);
        setTempoCurve(null);
        setLiveTempo(tempo);
        const racing = ephemeral ? null : (storedGhost ?? loadGhost(id));
        setGhost(racing);
        setGhostDone(0);
        runTempoRef.current = tempo;
        // The hand the matcher and the ghost step through: the whole grand staff
        // when there's a single staff, otherwise the hand being drilled. (Fingering
        // is printed on the staff at load time, not computed per run.)
        const osmd = osmdRef.current;
        const matcherHand: Hand = staffCount < 2 ? "both" : hand;
        // Re-render to wipe the previous run's note colours before starting afresh.
        if (paintedRef.current) {
            osmd?.render();
            paintedRef.current = false;
        }
        // Capture each step's rendered notes (post-render) so the ghost's colour can
        // mark, and move along, the actual notes on the staff as it races.
        ghostMarkRef.current = -1;
        ghostNotesRef.current = racing && osmd ? collectNoteElements(osmd, matcherHand) : [];
        matcher.start();
    };

    const handLabel: Record<Hand, string> = {
        both: m.hand_both(),
        right: m.hand_right(),
        left: m.hand_left(),
    };

    // Reveal the next note by colour per the player's hint setting — always, only
    // once they've slipped at this position, or never. A wrong key flashes red
    // regardless, so a miss is always felt.
    const noteHints = loadPrefs().noteHints;
    const hintNotes =
        noteHints === "always" || (noteHints === "miss" && matcher.missedHere)
            ? matcher.expected
            : [];

    // Listen and Practice — the two transport actions, shared by the normal toolbar and
    // the full-screen top bar (so full screen can hoist them out of the score's way).
    const transport = (
        <>
            <button
                type="button"
                disabled={!ready}
                onClick={() => (playing ? stopListen() : listen())}
                className={BUTTON_WITH_ICON}
            >
                {playing ? <StopIcon /> : <PlayIcon />}
                {playing ? m.action_listen_stop() : m.action_listen()}
            </button>
            <button
                type="button"
                disabled={!ready}
                onClick={() => (matcher.practicing ? matcher.stop() : practice())}
                className={BUTTON}
            >
                {matcher.practicing ? m.action_listen_stop() : m.curriculums_practice()}
            </button>
        </>
    );

    return (
        <div
            ref={rootRef}
            className={
                fullscreen
                    ? "fixed inset-0 z-50 flex flex-col gap-2 bg-white p-3 dark:bg-gray-950"
                    : "space-y-3"
            }
        >
            {fullscreen && (
                <div className="flex shrink-0 items-center gap-2">
                    {transport}
                    <button
                        type="button"
                        onClick={() => setHideKeyboard((on) => !on)}
                        aria-pressed={hideKeyboard}
                        className={`${BUTTON} ml-auto`}
                    >
                        {hideKeyboard ? m.action_show_keyboard() : m.action_hide_keyboard()}
                    </button>
                    <button
                        type="button"
                        onClick={exitFullscreen}
                        aria-label={m.action_exit_fullscreen()}
                        title={m.action_exit_fullscreen()}
                        className="rounded-md bg-indigo-600 p-2 text-white"
                    >
                        <MinimizeIcon />
                    </button>
                </div>
            )}
            {/* The score sits at the top — it's what you read while playing, so the
                controls, keyboard and run summary all fall below it. OSMD renders to
                its container's full offset width, which includes any border or
                padding on that element; were either on the element OSMD owns, the
                rendered system would overflow by exactly that amount and show a
                spurious scrollbar. So the border and breathing room live on the
                wrapper, and the inner element OSMD measures is clean. Wide scores
                still scroll horizontally, and that region must be focusable for
                keyboard users (axe scrollable-region-focusable). */}
            <div
                className={`rounded-md border border-gray-200 bg-white p-2 dark:border-gray-800 ${
                    fullscreen ? "flex min-h-0 flex-1 flex-col" : ""
                }`}
            >
                <div
                    ref={containerRef}
                    // biome-ignore lint/a11y/noNoninteractiveTabindex: a scrollable region needs keyboard access
                    tabIndex={0}
                    role="img"
                    aria-label={title}
                    // A bounded scroll box so the follow-cursor scrolls the staff inside
                    // it — keeping the controls and on-screen keyboard in view below
                    // rather than scrolling the whole page out from under them. Full screen
                    // hands it all the spare height (flex-1); otherwise it's shorter on a
                    // phone so the keys fit; dvh tracks the live viewport so the mobile URL
                    // bar doesn't clip it.
                    className={`overflow-auto ${
                        fullscreen ? "min-h-0 flex-1" : compact ? "max-h-[40dvh]" : "max-h-[70vh]"
                    }`}
                />
                {loadError && (
                    <p className="p-2 text-sm text-red-600 dark:text-red-400">
                        {m.score_load_error()}
                    </p>
                )}
            </div>

            {/* The normal toolbar. In full screen these all give way — transport moves to
                the top bar and everything past it folds away — so only the score and keys
                remain. The defaults (tempo from the piece, fingerings on, bars auto) are
                good, so the collapsed state loses nothing. */}
            {!fullscreen && (
                <div className="flex flex-wrap items-center gap-3">
                    {transport}
                    <button
                        type="button"
                        onClick={enterFullscreen}
                        aria-label={m.action_fullscreen()}
                        title={m.action_fullscreen()}
                        className={ICON_BUTTON}
                    >
                        <MaximizeIcon />
                    </button>
                    <details className="basis-full">
                        <summary className="cursor-pointer text-sm font-medium text-indigo-700 dark:text-indigo-300">
                            {m.more_options()}
                        </summary>
                        <div className="flex flex-wrap items-center gap-3 pt-2">
                            <button
                                type="button"
                                onClick={() =>
                                    setForgiving((on) => {
                                        const next = !on;
                                        savePrefs({ ...loadPrefs(), forgiving: next });
                                        return next;
                                    })
                                }
                                aria-pressed={forgiving}
                                title={m.forgiving_hint()}
                                className={
                                    forgiving
                                        ? "rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white"
                                        : BUTTON
                                }
                            >
                                {m.forgiving_toggle()}
                            </button>
                            <button
                                type="button"
                                onClick={() => setMetronomeOn((on) => !on)}
                                aria-pressed={metronomeOn}
                                className={
                                    metronomeOn
                                        ? "rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white"
                                        : BUTTON
                                }
                            >
                                {m.action_metronome()}
                            </button>
                            {metronomeOn && (
                                <span className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setAdaptive((on) => !on)}
                                        aria-pressed={adaptive}
                                        className={
                                            adaptive
                                                ? "rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white"
                                                : BUTTON
                                        }
                                    >
                                        {m.metronome_adaptive()}
                                    </button>
                                    {adaptive && (
                                        <Bpm
                                            tempo={liveTempo}
                                            className="text-sm text-gray-600 dark:text-gray-400"
                                        />
                                    )}
                                    <fieldset
                                        aria-label={m.metronome_subdivision()}
                                        className="flex items-center gap-1"
                                    >
                                        {[1, 2, 3, 4].map((n) => (
                                            <button
                                                key={n}
                                                type="button"
                                                onClick={() => setSubdivision(n)}
                                                aria-pressed={subdivision === n}
                                                className={
                                                    subdivision === n
                                                        ? "rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium tabular-nums text-white"
                                                        : `${BUTTON} tabular-nums`
                                                }
                                            >
                                                {n}
                                            </button>
                                        ))}
                                    </fieldset>
                                </span>
                            )}
                            {staffCount >= 2 && (
                                <fieldset
                                    aria-label={m.hand_label()}
                                    className="flex items-center gap-1"
                                >
                                    {(["both", "right", "left"] as const).map((option) => (
                                        <button
                                            key={option}
                                            type="button"
                                            // The hand is fixed once a run starts, so the choice
                                            // is locked while practicing to keep the count honest.
                                            disabled={matcher.practicing}
                                            onClick={() => setHand(option)}
                                            aria-pressed={hand === option}
                                            className={
                                                hand === option
                                                    ? "rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
                                                    : BUTTON
                                            }
                                        >
                                            {handLabel[option]}
                                        </button>
                                    ))}
                                </fieldset>
                            )}
                            {lockTempo ? (
                                <span className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                                    {m.scores_tempo()}
                                    <Bpm tempo={tempo} />
                                </span>
                            ) : (
                                <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                                    {m.scores_tempo()}
                                    <input
                                        type="range"
                                        min={40}
                                        max={180}
                                        value={tempo}
                                        onChange={(event) => setTempo(Number(event.target.value))}
                                        aria-label={m.scores_tempo()}
                                    />
                                    <Bpm tempo={tempo} className="w-12" />
                                </label>
                            )}
                            {!lockTempo && (
                                <span className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                                    <button
                                        type="button"
                                        onClick={() => setTrainerOn((on) => !on)}
                                        aria-pressed={trainerOn}
                                        className={
                                            trainerOn
                                                ? "rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white"
                                                : BUTTON
                                        }
                                    >
                                        {m.tempo_trainer()}
                                    </button>
                                    {trainerOn && (
                                        <>
                                            <span aria-hidden="true">→</span>
                                            <input
                                                type="range"
                                                min={40}
                                                max={180}
                                                value={trainerTarget}
                                                onChange={(event) =>
                                                    setTrainerTarget(Number(event.target.value))
                                                }
                                                aria-label={m.tempo_trainer_target()}
                                            />
                                            <Bpm tempo={trainerTarget} className="w-12" />
                                        </>
                                    )}
                                </span>
                            )}
                            {ready && measureCount > 1 && (
                                <span className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                                    <button
                                        type="button"
                                        onClick={() => setLoopOn((on) => !on)}
                                        aria-pressed={loopOn}
                                        className={
                                            loopOn
                                                ? "rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white"
                                                : BUTTON
                                        }
                                    >
                                        {m.loop_section()}
                                    </button>
                                    {loopOn && (
                                        <>
                                            <input
                                                type="number"
                                                min={1}
                                                max={measureCount}
                                                value={loopFrom}
                                                onChange={(event) => {
                                                    const value = Math.min(
                                                        Math.max(Number(event.target.value), 1),
                                                        measureCount,
                                                    );
                                                    setLoopFrom(value);
                                                    // The start can't pass the end — drag the end
                                                    // along so the range never inverts.
                                                    setLoopTo((to) => Math.max(to, value));
                                                }}
                                                aria-label={m.loop_from()}
                                                className={NUMBER_INPUT}
                                            />
                                            <span aria-hidden="true">–</span>
                                            <input
                                                type="number"
                                                min={loopFrom}
                                                max={measureCount}
                                                value={loopTo}
                                                onChange={(event) =>
                                                    setLoopTo(
                                                        Math.min(
                                                            Math.max(
                                                                Number(event.target.value),
                                                                loopFrom,
                                                            ),
                                                            measureCount,
                                                        ),
                                                    )
                                                }
                                                aria-label={m.loop_to()}
                                                className={NUMBER_INPUT}
                                            />
                                        </>
                                    )}
                                </span>
                            )}
                            {!lockTempo && (
                                <span className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400">
                                    {m.transpose()}
                                    <button
                                        type="button"
                                        disabled={transpose <= -12}
                                        onClick={() =>
                                            setTranspose((value) => Math.max(value - 1, -12))
                                        }
                                        aria-label={m.transpose_down()}
                                        className={`${BUTTON} tabular-nums`}
                                    >
                                        −
                                    </button>
                                    <span className="w-12 text-center font-mono tabular-nums">
                                        {m.transpose_semitones({
                                            count:
                                                transpose > 0
                                                    ? `+${transpose}`
                                                    : transpose < 0
                                                      ? `−${-transpose}`
                                                      : "0",
                                        })}
                                    </span>
                                    <button
                                        type="button"
                                        disabled={transpose >= 12}
                                        onClick={() =>
                                            setTranspose((value) => Math.min(value + 1, 12))
                                        }
                                        aria-label={m.transpose_up()}
                                        className={`${BUTTON} tabular-nums`}
                                    >
                                        +
                                    </button>
                                    {transpose !== 0 && (
                                        <button
                                            type="button"
                                            onClick={() => setTranspose(0)}
                                            aria-label={m.transpose_reset()}
                                            className={BUTTON}
                                        >
                                            ↺
                                        </button>
                                    )}
                                </span>
                            )}
                            {hasSaved && loadPrefs().showFingerings && (
                                <button
                                    type="button"
                                    onClick={() => setShowMine((on) => !on)}
                                    aria-pressed={showMine}
                                    className={
                                        showMine
                                            ? "rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white"
                                            : BUTTON
                                    }
                                >
                                    {m.fingering_show_mine()}
                                </button>
                            )}
                            <span className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400">
                                {m.bars_per_row()}
                                <fieldset
                                    aria-label={m.bars_per_row()}
                                    className="flex items-center gap-1"
                                >
                                    {BARS_PER_ROW.map((n) => (
                                        <button
                                            key={n}
                                            type="button"
                                            onClick={() => {
                                                setBarsPerRow(n);
                                                savePrefs({ ...loadPrefs(), barsPerRow: n });
                                            }}
                                            aria-pressed={barsPerRow === n}
                                            className={
                                                barsPerRow === n
                                                    ? "rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium tabular-nums text-white"
                                                    : `${BUTTON} tabular-nums`
                                            }
                                        >
                                            {n === 0 ? m.bars_per_row_auto() : n}
                                        </button>
                                    ))}
                                </fieldset>
                            </span>
                            <span className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400">
                                {m.keyboard_octaves()}
                                <fieldset
                                    aria-label={m.keyboard_octaves()}
                                    className="flex items-center gap-1"
                                >
                                    {KEYBOARD_OCTAVES.map((n) => (
                                        <button
                                            key={n}
                                            type="button"
                                            onClick={() => {
                                                setKeyboardOctaves(n);
                                                setKeyWindow(null);
                                                savePrefs({ ...loadPrefs(), keyboardOctaves: n });
                                            }}
                                            aria-pressed={keyboardOctaves === n}
                                            className={
                                                keyboardOctaves === n
                                                    ? "rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium tabular-nums text-white"
                                                    : `${BUTTON} tabular-nums`
                                            }
                                        >
                                            {n === 0 ? m.keyboard_octaves_all() : n}
                                        </button>
                                    ))}
                                </fieldset>
                            </span>
                        </div>
                    </details>
                </div>
            )}

            {ready && !fullscreen && (
                <div className="flex flex-wrap items-center gap-3">
                    <button
                        type="button"
                        onClick={printScore}
                        className={ICON_BUTTON}
                        aria-label={m.action_print()}
                        title={m.action_print()}
                    >
                        <PrinterIcon />
                    </button>
                    <button
                        type="button"
                        onClick={exportMidi}
                        className={ICON_BUTTON}
                        aria-label={m.action_export_midi()}
                        title={m.action_export_midi()}
                    >
                        <DownloadIcon />
                    </button>
                </div>
            )}

            <div
                hidden={ephemeral || fullscreen}
                className="flex flex-wrap items-center gap-3 text-sm"
            >
                {mastery?.learned ? (
                    <>
                        <span className="font-medium text-green-700 dark:text-green-400">
                            ✓ {m.mastery_learned()}
                        </span>
                        {isDue(mastery, Date.now()) && (
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                                {m.mastery_due()}
                            </span>
                        )}
                        <button
                            type="button"
                            onClick={toggleBacklog}
                            className="text-indigo-600 underline dark:text-indigo-400"
                        >
                            {mastery.backlog ? m.mastery_resume() : m.mastery_backlog()}
                        </button>
                    </>
                ) : (
                    <button
                        type="button"
                        onClick={markLearnedNow}
                        className="text-indigo-600 underline dark:text-indigo-400"
                    >
                        {m.mastery_mark_learned()}
                    </button>
                )}
            </div>

            {canShareGhost && storedGhost && !fullscreen && (
                <div className="flex flex-wrap items-center gap-3 text-sm">
                    {sharedFromLink && (
                        <span className="text-gray-600 dark:text-gray-400">
                            {m.ghost_shared_loaded()}
                        </span>
                    )}
                    <button type="button" onClick={shareGhost} className={BUTTON_WITH_ICON}>
                        <ShareIcon />
                        {shareStatus === "copied" ? m.ghost_share_copied() : m.ghost_share()}
                    </button>
                </div>
            )}

            {matcher.practicing && (
                <div className={`space-y-2 ${fullscreen ? "shrink-0" : ""}`}>
                    <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                        <span className="text-gray-600 dark:text-gray-400">
                            {m.play_progress()} {matcher.done} / {matcher.total}
                        </span>
                        {!connected && support === "supported" && (
                            <button
                                type="button"
                                onClick={requestAccess}
                                className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white"
                            >
                                {status === "requesting" ? m.midi_connecting() : m.midi_connect()}
                            </button>
                        )}
                        {support === "unsupported" && (
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                                {m.midi_unsupported_keyboard()}
                            </span>
                        )}
                    </div>
                    {ghost && (
                        <GhostTrack you={matcher.done} ghost={ghostDone} total={matcher.total} />
                    )}
                    {compact && portrait && coarsePointer && !connected && !rotateDismissed && (
                        <div className="flex items-center justify-between gap-2 rounded-md bg-indigo-50 px-3 py-2 text-sm text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200">
                            <span>{m.rotate_hint()}</span>
                            <button
                                type="button"
                                onClick={() => {
                                    localStorage.setItem("plinky:rotate-hint", "dismissed");
                                    setRotateDismissed(true);
                                }}
                                aria-label={m.action_dismiss()}
                                className="shrink-0 font-bold"
                            >
                                ✕
                            </button>
                        </div>
                    )}
                    {/* On a phone (portrait or landscape), a compact current-bars strip
                        right above the keys, so the notes to play aren't scrolled off
                        behind the keyboard; bigger screens — and full screen, where the
                        single score already fills the height — rely on the auto-scrolling
                        full score above. */}
                    {compact && !fullscreen && (
                        <FocusStrip
                            xml={focusXml}
                            bar={matcher.bar}
                            label={m.focus_strip_label()}
                        />
                    )}
                    {!(fullscreen && hideKeyboard) && (
                        <PianoKeyboard
                            expected={hintNotes}
                            wrong={matcher.lastWrong}
                            from={keyWindow?.from}
                            to={keyWindow?.to}
                        />
                    )}
                </div>
            )}

            {grade && !fullscreen && (
                <div className="space-y-3">
                    <div className="flex items-center gap-4 rounded-md border border-gray-200 p-3 dark:border-gray-800">
                        <div
                            className={`text-5xl font-bold leading-none ${GRADE_COLOR[grade.letter]}`}
                        >
                            {grade.letter}
                        </div>
                        <dl className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-sm">
                            <dt className="text-gray-500 dark:text-gray-400">
                                {m.scores_accuracy()}
                            </dt>
                            <dd className="text-right font-mono tabular-nums">{grade.accuracy}%</dd>
                            <dt className="text-gray-500 dark:text-gray-400">
                                {m.scores_timing()}
                            </dt>
                            <dd className="text-right font-mono tabular-nums">{grade.timing}%</dd>
                            <dt className="text-gray-500 dark:text-gray-400">{m.scores_flow()}</dt>
                            <dd className="text-right font-mono tabular-nums">{grade.flow}%</dd>
                            {grade.dynamics !== null && (
                                <>
                                    <dt className="text-gray-400 dark:text-gray-500">
                                        {m.scores_dynamics()}
                                    </dt>
                                    <dd className="text-right font-mono tabular-nums text-gray-500 dark:text-gray-400">
                                        {grade.dynamics}%
                                    </dd>
                                </>
                            )}
                        </dl>
                    </div>
                    <PerformanceStrip notes={runNotes} />
                    {tempoCurve && (
                        <section className="space-y-1">
                            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">
                                {m.tempo_heading()}
                            </h3>
                            <TempoGraph
                                points={tempoCurve.points}
                                median={tempoCurve.median}
                                hotspots={tempoCurve.hotspots}
                            />
                        </section>
                    )}
                    {shareGrid && (
                        <ShareCard
                            grid={shareGrid}
                            caption={m.share_heading()}
                            gridLabel={m.share_grid_label()}
                            rowLabels={[m.scores_accuracy(), m.scores_timing(), m.scores_flow()]}
                            boast={
                                daily != null
                                    ? `${m.daily_share_boast({ number: daily, grade: grade.letter })}${dailyStreak > 1 ? ` · 🔥${dailyStreak}` : ""}`
                                    : m.share_boast({ title })
                            }
                            heading={
                                daily != null
                                    ? `🎹 Plinky #${daily} ${grade.letter}${dailyStreak > 1 ? ` · 🔥${dailyStreak}` : ""}`
                                    : title
                            }
                        />
                    )}
                </div>
            )}
        </div>
    );
}
