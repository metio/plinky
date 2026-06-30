// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { Cursor, OpenSheetMusicDisplay } from "opensheetmusicdisplay";
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { useMidiConnection, useMidiInput } from "../contexts/midi";
import { FullScreen, FullscreenProvider, Midi, Show, useMidiConnected } from "./conditional";
import { useFullscreen } from "../hooks/useFullscreen";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { useMetronome } from "../hooks/useMetronome";
import { type CorrectInfo, type Hand, useScoreMatcher } from "../hooks/useScoreMatcher";
import { useSynth } from "../hooks/useSynth";
import { summarizeDynamics } from "../lib/dynamics";
import { annotateFingerings } from "../lib/fingerScore";
import { computeFlow } from "../lib/flow";
import { cadence } from "../lib/cadence";
import { recordDailyDone } from "../lib/dailyDone";
import { type DailyResult, saveDailyResult } from "../lib/dailyResult";
import { recordPractice } from "../lib/history";
import { computeGrade, GRADE_COLOR, type Grade } from "../lib/grade";
import { currentGrade, loadGradedMastery, skillRating } from "../lib/gradeProgress";
import { nextKeyboardWindow, type Span } from "../lib/keyboardWindow";
import { recordRun } from "../lib/lifetime";
import { svgMilestone } from "../lib/milestoneCard";
import {
    flawlessDone,
    isFirstS,
    isFlawless,
    type Milestone,
    reachedGrade,
    recordFlawless,
    recordReachedGrade,
} from "../lib/milestones";
import { applyRun, isDue, letterMin, loadMastery, setBacklog } from "../lib/mastery";
import { writeMastery } from "../lib/masteryStore";
import { useMastery } from "../hooks/useMastery";
import { BARS_PER_ROW, KEYBOARD_OCTAVES, loadPrefs, savePrefs } from "../lib/prefs";
import { loadSongFingering } from "../lib/savedFingering";
import { decodeGhost, ghostReached, loadGhost, saveGhost } from "../lib/recording";
import {
    compositionFromRun,
    fastestTakeOnsets,
    loadTakes,
    removeTake,
    type RunStep,
    saveTake,
    type Take,
} from "../lib/savedTakes";
import { isPreciseInput } from "../lib/midi";
import {
    LENIENT_TOLERANCE,
    makeHit,
    PRECISE_TOLERANCE,
    summarize,
    timingDeltas,
} from "../lib/rhythm";
import {
    collectNoteElements,
    GHOST_COLOR,
    highlightCursorNotes,
    NOTE_COLOR,
    type PaintedNote,
    paintElement,
    paintPlayedNotes,
    PLAYED_COLOR,
    restoreNotes,
    WINDOW_COLOR,
} from "../lib/scoreColor";
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
import { Bpm } from "./bpm";
import { Button, IconButton } from "./button";
import { Disclosure, FieldGroup } from "./disclosure";
import { FocusStrip } from "./focusStrip";
import { GhostTrack } from "./ghostTrack";
import { useTranspose } from "./transposeContext";
import { ShareGhostButton } from "./shareGhostButton";
import { TakesList } from "./takesList";
import {
    CheckIcon,
    CloseIcon,
    MaximizeIcon,
    MinimizeIcon,
    PlayIcon,
    RotateIcon,
    StopIcon,
} from "./icons";
import { PerformanceStrip } from "./performanceStrip";
import { PianoKeyboard } from "./pianoKeyboard";
import { SegmentedControl } from "./segmentedControl";
import { ShareButtons } from "./shareButtons";
import { ShareCard } from "./shareCard";
import { BumpValue, Stepper } from "./stepper";
import { Switch } from "./switch";
import { TempoGraph } from "./tempoGraph";

// A cleared note plus the velocity it was played at and the pitches sounded at
// that step — the run's raw record, from which the grade, the per-note strip and
// the share grid are derived, and a saved take's notes are reconstructed.
type PlayedNote = RunNote & { velocity: number; pitches: number[] };

// A typed bar number for the loop range — a number field (not a stepper), because a
// piece can run to many bars and typing the target beats tapping a stepper there.
const NUMBER_INPUT =
    "w-14 rounded-md border border-gray-300 bg-transparent px-2 py-1 text-sm tabular-nums text-gray-700 dark:border-gray-700 dark:text-gray-300";

// A lead-in label for a selector or slider inside the practice-tools panel, so each
// control names itself without a separate heading per row.
function Labeled({ label, children }: { label: ReactNode; children: ReactNode }) {
    return (
        <span className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <span>{label}</span>
            {children}
        </span>
    );
}

// A celebratory banner for an earned moment (first S, grade-up, flawless run), with the
// matching share card to post. Quiet — it sits above the run grid, never interrupts.
function MilestoneBanner({ milestone }: { milestone: Milestone }) {
    const heading =
        milestone.kind === "grade-up"
            ? m.milestone_grade_heading({ level: milestone.grade })
            : milestone.kind === "flawless"
              ? m.milestone_flawless_heading({ title: milestone.songTitle })
              : m.milestone_first_s_heading({ title: milestone.songTitle });
    const cardTitle =
        milestone.kind === "grade-up"
            ? m.grades_current({ level: milestone.grade })
            : milestone.kind === "flawless"
              ? m.milestone_flawless_title()
              : m.milestone_first_s_title();
    const detail =
        milestone.kind === "grade-up"
            ? milestone.skill > 0
                ? m.grades_skill({ rating: milestone.skill })
                : undefined
            : milestone.songTitle;
    const boast =
        milestone.kind === "grade-up"
            ? m.milestone_grade_boast({ level: milestone.grade })
            : milestone.kind === "flawless"
              ? m.milestone_flawless_boast({ title: milestone.songTitle })
              : m.milestone_first_s_boast({ title: milestone.songTitle });
    return (
        <section className="space-y-2 rounded-md border border-indigo-200 bg-indigo-50/50 p-4 dark:border-indigo-900 dark:bg-indigo-950/30">
            <h3 className="text-sm font-semibold text-indigo-800 dark:text-indigo-200">
                {heading}
            </h3>
            <ShareButtons
                text={boast}
                imageSvg={svgMilestone({ title: cardTitle, detail })}
                imageText={boast}
            />
        </section>
    );
}

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
    seededResult,
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
    // it as "Plinky N" rather than by the piece, so everyone compares one grid. No
    // "#": some social clients linkify "#N" into a meaningless number hashtag.
    daily?: number;
    // A throwaway piece, like a freshly generated sprint, that still counts toward
    // the practice history and fingerprint but is never tracked for spaced repetition.
    ephemeral?: boolean;
    // Bundled pieces have a stable id every player shares, so their ghost can be
    // sent to a friend by link and loaded back via a ?ghost= code.
    canShareGhost?: boolean;
    // A previously finished run to show on open, so re-visiting the day's challenge
    // surfaces the result instead of a blank slate. Replaced the moment a new run ends.
    seededResult?: DailyResult | null;
}) {
    const containerRef = useRef<HTMLDivElement>(null);
    const rootRef = useRef<HTMLDivElement>(null);
    const gradePanelRef = useRef<HTMLDivElement>(null);
    // True only once a run finishes this session, so the result scroll fires on
    // completion but not when the grade is seeded from a saved result on mount.
    const gradeFromRunRef = useRef(false);
    const osmdRef = useRef<OpenSheetMusicDisplay | null>(null);
    const timers = useRef<number[]>([]);
    // The notes Listen has lit as "now sounding", held so the highlight can be lifted
    // when the cursor moves on and when playback stops.
    const listenHighlightRef = useRef<PaintedNote[]>([]);
    // Tracks playback synchronously, so a second click that lands before the
    // `playing` state has re-rendered can't start a second cursor loop.
    const playingRef = useRef(false);
    const tempoRef = useRef(initialTempo ?? 100);
    const notesRef = useRef<PlayedNote[]>([]);
    const startRef = useRef(0);
    const baseOffsetRef = useRef(0);
    // Whether any note this run came from an imprecise input (on-screen or computer
    // keyboard). Those can't tap a true rhythm, so the run's timing is graded with
    // widened windows rather than flooring a touch player — the primary input — at
    // zero. Reset when a run starts; read when it is graded.
    const impreciseRef = useRef(false);
    const synth = useSynth();
    const [ready, setReady] = useState(false);
    const [loadError, setLoadError] = useState(false);
    const [playing, setPlaying] = useState(false);
    // This score's saved takes, the take currently replaying (if any), and whether
    // the finished run has already been saved — so its save prompt shows just once.
    const [takes, setTakes] = useState<Take[]>([]);
    const [activeReplayId, setActiveReplayId] = useState<string | null>(null);
    const [runSaved, setRunSaved] = useState(false);
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
    // Transpose comes from the page when one provides it (so the title-line Print /
    // Export buttons share the key), otherwise from local state (daily, review).
    const transposeContext = useTranspose();
    const localTranspose = useState(0);
    const [transpose, setTranspose] = transposeContext
        ? [transposeContext.transpose, transposeContext.setTranspose]
        : localTranspose;
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
    // Render the piece as one horizontal line that scrolls under a fixed gaze, instead of
    // wrapping into rows — the "treadmill" reading mode. Off by default.
    const [treadmill, setTreadmill] = useState(() => loadPrefs().treadmill);
    const [raceGhost, setRaceGhost] = useState(() => loadPrefs().raceGhost);
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

    // A metronome on demand: fixed at the chosen tempo, or following the player's
    // own pace when adaptive.
    useMetronome(metronomeOn, adaptive ? liveTempo : tempo, beatsPerBar ?? 4, subdivision);
    const [grade, setGrade] = useState<Grade | null>(seededResult?.grade ?? null);
    const [runNotes, setRunNotes] = useState<RunNote[]>(seededResult?.notes ?? []);
    // The timing leniency the finished run was graded at, kept so the per-note strip
    // reads the same windows as the grade and share grid.
    const [runTolerance, setRunTolerance] = useState(seededResult?.tolerance ?? PRECISE_TOLERANCE);
    const [shareGrid, setShareGrid] = useState<Grid | null>(seededResult?.grid ?? null);
    // An earned-moment card (first S, grade-up, flawless run) shown above the run grid,
    // resolved after the run's mastery is folded in. At most one per run.
    const [milestone, setMilestone] = useState<Milestone | null>(null);
    const [tempoCurve, setTempoCurve] = useState<{
        points: TempoPoint[];
        median: number;
        hotspots: Hotspot[];
    } | null>(null);
    // Mastery comes from the shared store, so a mark-learned anywhere (here, or a
    // MarkLearnedButton on the page) re-renders every view of it together. Ephemeral
    // pieces (sprints) aren't tracked, so they read as null.
    const storedMastery = useMastery(id);
    const mastery = ephemeral ? null : storedMastery;
    // The tempo a run was matched at, captured when practice starts so the run's
    // self-paced tempo curve reads against the same reference the matcher used,
    // even if the slider is moved afterwards.
    const runTempoRef = useRef(initialTempo ?? 100);
    // Whether any note has been coloured on the score, so a fresh run re-renders to
    // clear last run's progress only when there is something to clear.
    const paintedRef = useRef(false);

    // Load this score's saved takes; a new score swaps in its own.
    useEffect(() => {
        setTakes(loadTakes(id));
    }, [id]);

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
                    pitches: [...info.pitches],
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
        onNoteOn: (event) => {
            if (!isPreciseInput(event.device)) {
                impreciseRef.current = true;
            }
            matcher.registerNote(event.note, event.timestamp, event.velocity);
        },
    });
    const { status, requestAccess } = useMidiConnection();
    const connected = useMidiConnected();

    // In treadmill mode OSMD's own follow-cursor is off, so the active bar is centred by
    // hand: scroll its box horizontally to bring the cursor to the middle — the fixed gaze
    // the music slides under. A no-op when not treadmill or the cursor isn't shown.
    const centerCursor = useCallback(() => {
        if (!treadmill) {
            return;
        }
        const el = osmdRef.current?.cursor?.cursorElement;
        const box = containerRef.current;
        if (el && box) {
            box.scrollTo({ left: el.offsetLeft - box.clientWidth / 2, behavior: "smooth" });
        }
    }, [treadmill]);

    // Slide the keyboard window to keep the notes being played in view, re-framing only
    // when they leave it. Falls back to the whole range (null window) when not practising,
    // where PianoKeyboard's own default applies.
    useEffect(() => {
        setKeyWindow((prev) =>
            nextKeyboardWindow(prev, matcher.range, matcher.expected, keyboardSpan),
        );
    }, [matcher.range, matcher.expected, keyboardSpan]);

    // When a run finishes, bring the result into view: the player's eyes are on the
    // keyboard, and the grade renders below it (and below the whole score on the way
    // out of full screen), so it can otherwise land off-screen unnoticed. Honour
    // reduced-motion, and wait a frame so the post-run layout has settled first.
    // Re-opening a finished daily seeds the grade on mount; that must not yank the
    // page down, so scroll only for a run completed in this session.
    useEffect(() => {
        if (!grade || !gradeFromRunRef.current) {
            return;
        }
        const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        const id = requestAnimationFrame(() => {
            gradePanelRef.current?.scrollIntoView({
                behavior: smooth ? "smooth" : "auto",
                block: "center",
            });
        });
        return () => cancelAnimationFrame(id);
    }, [grade]);

    // Re-centre the treadmill as the matcher advances through the piece — the cursor
    // position isn't a value centerCursor reads, so depend on done/practicing to fire it.
    // biome-ignore lint/correctness/useExhaustiveDependencies: done/practicing are the advance signal, not centerCursor inputs
    useEffect(() => {
        centerCursor();
    }, [centerCursor, matcher.done, matcher.practicing]);

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
    // dynamics rather than crediting a constant. Timing is judged against the
    // player's own pace (so a steady run at any tempo reads as in time) with windows
    // widened for imprecise input (on-screen / computer keyboard).
    useEffect(() => {
        if (!matcher.complete) {
            return;
        }
        const notes = notesRef.current;
        const velocities = notes.map((note) => note.velocity);
        const hasDynamics = new Set(velocities).size > 1;
        const tolerance = impreciseRef.current ? LENIENT_TOLERANCE : PRECISE_TOLERANCE;
        const deltas = timingDeltas(notes);
        const hits = deltas.map((delta, index) => makeHit(index, delta, tolerance));
        const result = computeGrade({
            correct: matcher.total,
            wrong: matcher.wrong,
            rhythm: summarize(hits),
            flow: computeFlow(notes),
            dynamics: hasDynamics ? summarizeDynamics(velocities) : null,
        });
        const grid = gridFor(notes, tolerance);
        gradeFromRunRef.current = true;
        setGrade(result);
        // A short major flourish to celebrate finishing — a fuller arpeggio for a
        // stronger grade, a gentle lift for a weaker one, never a penalty. playNote
        // no-ops when sound is muted, so the mute checkbox is the gate.
        for (const beat of cadence(result.letter)) {
            synth.playNote(beat.note, {
                velocity: beat.velocity,
                duration: beat.duration,
                delay: beat.at,
            });
        }
        setRunNotes(notes);
        setRunTolerance(tolerance);
        setShareGrid(grid);
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
        // Mark the day's challenge done so it shows a ✓ — no streak, just "played" —
        // and keep its result so re-opening the daily shows it rather than a blank run.
        if (daily != null) {
            recordDailyDone(daily);
            saveDailyResult(daily, { grade: result, grid, notes, tolerance });
        }
        // Count the run's notes toward the practice history.
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
        const before = loadMastery(id);
        const threshold = letterMin(loadPrefs().masteryThreshold);
        const updated = applyRun(before, result.score, threshold, Date.now());
        writeMastery(id, updated);
        onMastery?.();

        // Surface one earned-moment card. Grade-up is the biggest moment so it wins a
        // tie; the others it pre-empts can still fire on a later run (a flawless run
        // keeps its one-time flag; a song's first S is guarded by its best score, so a
        // grade-up that buries it is a rare, accepted loss). A grade-up is read from the
        // ladder recomputed across all mastery, so it resolves asynchronously.
        const firstS = isFirstS(result.score, before?.bestScore ?? 0);
        const flawlessNow = isFlawless(result.score) && !flawlessDone();
        const prefs = loadPrefs();
        // The grade-up check reads the ladder across the whole catalogue, so it resolves
        // asynchronously; the first-S and flawless checks above are already decided.
        loadGradedMastery().then((items) => {
            const reached = currentGrade(items);
            if (reached > reachedGrade()) {
                recordReachedGrade(reached);
                const rating = skillRating(items, prefs.decayMode, Date.now());
                setMilestone({ kind: "grade-up", grade: reached, skill: rating });
            } else if (flawlessNow) {
                recordFlawless();
                setMilestone({ kind: "flawless", songTitle: title });
            } else if (firstS) {
                setMilestone({ kind: "first-s", songTitle: title });
            }
        });
    }, [
        matcher.complete,
        matcher.total,
        matcher.wrong,
        id,
        title,
        onMastery,
        ephemeral,
        daily,
        bumpTempo,
        synth,
    ]);

    // Finishing a run leaves full-screen play, so the grade, share card and per-note
    // strip — all hidden while full screen to keep the play surface clean — come into
    // view. Without this a completed full-screen run looks stuck: the score just ends
    // with nothing shown. The hook's fullscreenchange sync keeps state honest if the
    // player has already left on their own.
    useEffect(() => {
        if (matcher.complete && fullscreen) {
            exitFullscreen();
        }
    }, [matcher.complete, fullscreen, exitFullscreen]);

    const toggleBacklog = () => {
        const updated = setBacklog(mastery, !mastery?.backlog, Date.now());
        writeMastery(id, updated);
        onMastery?.();
    };

    const stopListen = () => {
        for (const id of timers.current) {
            window.clearTimeout(id);
        }
        timers.current = [];
        restoreNotes(listenHighlightRef.current);
        listenHighlightRef.current = [];
        if (!matcher.practicing) {
            osmdRef.current?.cursor?.hide();
        }
        playingRef.current = false;
        setPlaying(false);
        setActiveReplayId(null);
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
                    // you to scroll — critical on a phone where the staff is tall. The
                    // treadmill drives its own horizontal centring, so OSMD's vertical
                    // follow is turned off there.
                    followCursor: !treadmill,
                    // One continuous horizontal staffline that scrolls right, rather than
                    // wrapping into rows — the treadmill reading mode.
                    renderSingleHorizontalStaffline: treadmill,
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
            // A change of layout (bars-per-row, treadmill, transpose) re-runs this
            // effect, building a fresh OSMD on the same container. OSMD renders into a
            // new SVG rather than replacing the old one, so without removing the previous
            // render its SVG stays behind and each switch stacks another copy. clear()
            // frees OSMD's own state but leaves its <svg> in the DOM, so empty the
            // container too.
            osmdRef.current?.clear();
            containerRef.current?.replaceChildren();
        };
    }, [xml, transpose, showMine, saved, barsPerRow, treadmill]);

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
            // Light the notes now sounding so the eye can follow the music, lifting the
            // previous step's highlight first — the cursor box alone is easy to lose.
            restoreNotes(listenHighlightRef.current);
            listenHighlightRef.current = highlightCursorNotes(osmd, WINDOW_COLOR);
            let beats = 1;
            for (const note of cursor.NotesUnderCursor()) {
                const quarters = note.Length.RealValue * 4;
                if (!note.isRest() && note.halfTone > 0) {
                    synth.playNote(note.halfTone + 12, { duration: quarters });
                }
                beats = Math.max(beats, quarters);
            }
            cursor.next();
            centerCursor();
            timers.current.push(window.setTimeout(tick, beats * (60000 / tempoRef.current)));
        };
        tick();
    };

    // Save the just-finished run as a take: rebuild a Composition from the captured
    // steps (their played onsets, pitches and velocity) and store it under this song.
    const saveCurrentTake = () => {
        const steps: RunStep[] = notesRef.current.map((note) => ({
            pitches: note.pitches,
            startMs: note.playedMs,
            velocity: note.velocity,
        }));
        if (steps.length === 0) {
            return;
        }
        const take: Take = {
            id: crypto.randomUUID(),
            createdAt: Date.now(),
            letter: grade?.letter ?? "",
            complete: matcher.complete,
            composition: compositionFromRun(steps, tempo, beatsPerBar ?? 4),
        };
        setTakes(saveTake(id, take));
        setRunSaved(true);
    };

    // Replay a saved take onto the staff: walk the cursor as Listen does, but step it
    // on the take's own recorded onsets so the playback keeps your timing. Rest-only
    // steps advance without consuming an onset, keeping notes aligned to the take.
    const replayTake = (take: Take) => {
        const osmd = osmdRef.current;
        if (!osmd) {
            return;
        }
        if (playingRef.current) {
            stopListen();
        }
        playingRef.current = true;
        matcher.stop();
        setActiveReplayId(take.id);
        const cursor: Cursor = osmd.cursor;
        cursor.reset();
        cursor.show();
        setPlaying(true);
        const onsets = [...new Set(take.composition.notes.map((note) => note.startMs))].sort(
            (a, b) => a - b,
        );
        let step = 0;
        const tick = () => {
            if (cursor.iterator.EndReached || step >= onsets.length) {
                stopListen();
                return;
            }
            restoreNotes(listenHighlightRef.current);
            listenHighlightRef.current = highlightCursorNotes(osmd, WINDOW_COLOR);
            let hasNote = false;
            for (const note of cursor.NotesUnderCursor()) {
                const quarters = note.Length.RealValue * 4;
                if (!note.isRest() && note.halfTone > 0) {
                    hasNote = true;
                    synth.playNote(note.halfTone + 12, { duration: quarters });
                }
            }
            cursor.next();
            centerCursor();
            if (hasNote) {
                const current = onsets[step] ?? 0;
                const next = onsets[step + 1];
                step++;
                const delay = next !== undefined ? Math.max(40, next - current) : 500;
                timers.current.push(window.setTimeout(tick, delay));
            } else {
                // A rest under the cursor: advance briskly without spending an onset.
                timers.current.push(window.setTimeout(tick, 30));
            }
        };
        tick();
    };

    const deleteTake = (takeId: string) => {
        if (activeReplayId === takeId) {
            stopListen();
        }
        setTakes(removeTake(id, takeId));
    };

    const practice = () => {
        stopListen();
        setRunSaved(false);
        notesRef.current = [];
        impreciseRef.current = false;
        gradeFromRunRef.current = false;
        setGrade(null);
        setRunNotes([]);
        setShareGrid(null);
        setMilestone(null);
        setTempoCurve(null);
        setLiveTempo(tempo);
        // Your fastest complete take is the ghost to chase; falling back to the last
        // run (or a friend's shared ghost) when you've saved none.
        const racing =
            ephemeral || !raceGhost
                ? null
                : (fastestTakeOnsets(loadTakes(id)) ?? storedGhost ?? loadGhost(id));
        setGhost(racing);
        setGhostDone(0);
        runTempoRef.current = tempo;
        // The first note of the run seeds these (ordinal 0); clear them here so the
        // ghost tick's `startRef.current > 0` guard holds until that note arrives.
        // A stale start timestamp from a prior run would make the elapsed time huge
        // and paint the ghost at the finish from the moment Practice is pressed.
        startRef.current = 0;
        baseOffsetRef.current = 0;
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
            <Button
                variant="secondary"
                disabled={!ready}
                onClick={() => (playing ? stopListen() : listen())}
            >
                {playing ? <StopIcon /> : <PlayIcon />}
                {playing ? m.action_listen_stop() : m.action_listen()}
            </Button>
            {/* Practice is the screen's primary action, so it carries the dominant
                filled variant rather than reading as a twin of Listen. */}
            <Button
                variant="primary"
                disabled={!ready}
                onClick={() => (matcher.practicing ? matcher.stop() : practice())}
            >
                {matcher.practicing ? m.action_listen_stop() : m.action_practice()}
            </Button>
        </>
    );

    return (
        <FullscreenProvider active={fullscreen}>
            <div
                ref={rootRef}
                className={
                    fullscreen
                        ? "fixed inset-0 z-50 flex flex-col gap-2 bg-white p-3 dark:bg-gray-950"
                        : "space-y-3"
                }
            >
                <FullScreen>
                    <div className="flex shrink-0 items-center gap-2">
                        {transport}
                        <Show when={matcher.practicing}>
                            <span className="text-sm tabular-nums text-gray-600 dark:text-gray-400">
                                {matcher.done}/{matcher.total}
                            </span>
                        </Show>
                        <Button
                            variant="secondary"
                            onClick={() => setHideKeyboard((on) => !on)}
                            aria-pressed={hideKeyboard}
                            className="ml-auto"
                        >
                            {hideKeyboard ? m.action_show_keyboard() : m.action_hide_keyboard()}
                        </Button>
                        <IconButton
                            variant="primary"
                            onClick={exitFullscreen}
                            label={m.action_exit_fullscreen()}
                        >
                            <MinimizeIcon />
                        </IconButton>
                    </div>
                </FullScreen>
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
                        // The min-height reserves the staff area before OSMD has
                        // rendered, so the score growing in on load doesn't shove the
                        // controls and keyboard below it down the page (a CLS hit that
                        // Lighthouse amplifies under CPU throttling). The max-height keeps
                        // it from crowding the keyboard off-screen; taller scores scroll.
                        className={`no-scrollbar overflow-auto ${
                            fullscreen
                                ? "min-h-0 flex-1"
                                : compact
                                  ? "h-[40dvh]"
                                  : "min-h-[50vh] max-h-[70vh]"
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
                <FullScreen off>
                    <div className="flex flex-wrap items-center gap-3">
                        {transport}
                        <IconButton onClick={enterFullscreen} label={m.action_fullscreen()}>
                            <MaximizeIcon />
                        </IconButton>
                        <Disclosure summary={m.more_options()}>
                            <FieldGroup label={m.group_tempo()}>
                                {lockTempo ? (
                                    <Labeled label={m.scores_tempo()}>
                                        <Bpm tempo={tempo} />
                                    </Labeled>
                                ) : (
                                    <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                                        <span>{m.scores_tempo()}</span>
                                        <input
                                            type="range"
                                            min={40}
                                            max={180}
                                            value={tempo}
                                            onChange={(event) =>
                                                setTempo(Number(event.target.value))
                                            }
                                            aria-label={m.scores_tempo()}
                                        />
                                        <BumpValue
                                            value={tempo}
                                            className="w-12 font-semibold text-gray-800 dark:text-gray-200"
                                        />
                                    </label>
                                )}
                                {!lockTempo && (
                                    <Switch
                                        checked={trainerOn}
                                        onChange={setTrainerOn}
                                        label={m.tempo_trainer()}
                                    />
                                )}
                                {!lockTempo && trainerOn && (
                                    <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                                        <span>{m.tempo_trainer_target()}</span>
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
                                    </label>
                                )}
                            </FieldGroup>

                            <FieldGroup label={m.group_metronome()}>
                                <Switch
                                    checked={metronomeOn}
                                    onChange={setMetronomeOn}
                                    label={m.action_metronome()}
                                />
                                {metronomeOn && (
                                    <Switch
                                        checked={adaptive}
                                        onChange={setAdaptive}
                                        label={m.metronome_adaptive()}
                                    />
                                )}
                                {metronomeOn && adaptive && (
                                    <Bpm
                                        tempo={liveTempo}
                                        className="text-sm text-gray-600 dark:text-gray-400"
                                    />
                                )}
                                {metronomeOn && (
                                    <Labeled label={m.metronome_subdivision()}>
                                        <SegmentedControl
                                            options={[1, 2, 3, 4].map((n) => ({
                                                id: String(n),
                                                label: String(n),
                                            }))}
                                            value={String(subdivision)}
                                            onChange={(id) => setSubdivision(Number(id))}
                                            label={m.metronome_subdivision()}
                                        />
                                    </Labeled>
                                )}
                            </FieldGroup>

                            <FieldGroup label={m.group_practice()}>
                                <Switch
                                    checked={forgiving}
                                    onChange={(next) => {
                                        savePrefs({ ...loadPrefs(), forgiving: next });
                                        setForgiving(next);
                                    }}
                                    label={m.forgiving_toggle()}
                                    title={m.forgiving_hint()}
                                />
                                <Switch
                                    checked={raceGhost}
                                    onChange={(next) => {
                                        savePrefs({ ...loadPrefs(), raceGhost: next });
                                        setRaceGhost(next);
                                    }}
                                    label={m.race_ghost_toggle()}
                                    title={m.race_ghost_hint()}
                                />
                                {staffCount >= 2 && (
                                    <Labeled label={m.hand_label()}>
                                        <SegmentedControl
                                            options={(["both", "right", "left"] as const).map(
                                                (option) => ({
                                                    id: option,
                                                    label: handLabel[option],
                                                }),
                                            )}
                                            value={hand}
                                            onChange={setHand}
                                            label={m.hand_label()}
                                            // Locked mid-run so the matched note count stays honest.
                                            disabled={matcher.practicing}
                                        />
                                    </Labeled>
                                )}
                                {ready && measureCount > 1 && (
                                    <Switch
                                        checked={loopOn}
                                        onChange={setLoopOn}
                                        label={m.loop_section()}
                                    />
                                )}
                                {ready && measureCount > 1 && loopOn && (
                                    <span className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
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
                                    </span>
                                )}
                            </FieldGroup>

                            {/* Skip the whole group when it would be empty — a locked
                                challenge has no transpose, and most pieces have no saved
                                fingering, so the heading would otherwise stand alone. */}
                            {(!lockTempo || (hasSaved && loadPrefs().showFingerings)) && (
                                <FieldGroup label={m.group_notation()}>
                                    {!lockTempo && (
                                        <span className="flex flex-col gap-1">
                                            <span className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                                                <span>{m.transpose()}</span>
                                                <Stepper
                                                    value={m.transpose_semitones({
                                                        count:
                                                            transpose > 0
                                                                ? `+${transpose}`
                                                                : transpose < 0
                                                                  ? `−${-transpose}`
                                                                  : "0",
                                                    })}
                                                    decrementLabel={m.transpose_down()}
                                                    incrementLabel={m.transpose_up()}
                                                    canDecrement={transpose > -12}
                                                    canIncrement={transpose < 12}
                                                    onDecrement={() =>
                                                        setTranspose((value) =>
                                                            Math.max(value - 1, -12),
                                                        )
                                                    }
                                                    onIncrement={() =>
                                                        setTranspose((value) =>
                                                            Math.min(value + 1, 12),
                                                        )
                                                    }
                                                />
                                                {transpose !== 0 && (
                                                    <IconButton
                                                        variant="ghost"
                                                        label={m.transpose_reset()}
                                                        onClick={() => setTranspose(0)}
                                                    >
                                                        <RotateIcon className="h-5 w-5" />
                                                    </IconButton>
                                                )}
                                            </span>
                                            <span className="text-xs text-gray-500 dark:text-gray-400">
                                                {m.transpose_caption()}
                                            </span>
                                        </span>
                                    )}
                                    {hasSaved && loadPrefs().showFingerings && (
                                        <Switch
                                            checked={showMine}
                                            onChange={setShowMine}
                                            label={m.fingering_show_mine()}
                                        />
                                    )}
                                </FieldGroup>
                            )}

                            <FieldGroup label={m.group_layout()}>
                                <Switch
                                    checked={treadmill}
                                    onChange={(next) => {
                                        savePrefs({ ...loadPrefs(), treadmill: next });
                                        setTreadmill(next);
                                    }}
                                    label={m.treadmill_toggle()}
                                    title={m.treadmill_hint()}
                                />
                                {/* Bars-per-row only shapes the wrapped layout; the treadmill is
                                a single line, so the control would do nothing there. */}
                                {!treadmill && (
                                    <Labeled label={m.bars_per_row()}>
                                        <SegmentedControl
                                            options={BARS_PER_ROW.map((n) => ({
                                                id: String(n),
                                                label: n === 0 ? m.bars_per_row_auto() : String(n),
                                            }))}
                                            value={String(barsPerRow)}
                                            onChange={(id) => {
                                                const n = Number(id);
                                                setBarsPerRow(n);
                                                savePrefs({ ...loadPrefs(), barsPerRow: n });
                                            }}
                                            label={m.bars_per_row()}
                                        />
                                    </Labeled>
                                )}
                                <Labeled label={m.keyboard_octaves()}>
                                    <SegmentedControl
                                        options={KEYBOARD_OCTAVES.map((n) => ({
                                            id: String(n),
                                            label: n === 0 ? m.keyboard_octaves_all() : String(n),
                                        }))}
                                        value={String(keyboardOctaves)}
                                        onChange={(id) => {
                                            const n = Number(id);
                                            setKeyboardOctaves(n);
                                            setKeyWindow(null);
                                            savePrefs({ ...loadPrefs(), keyboardOctaves: n });
                                        }}
                                        label={m.keyboard_octaves()}
                                    />
                                </Labeled>
                            </FieldGroup>
                        </Disclosure>
                    </div>
                </FullScreen>

                <div
                    hidden={ephemeral || fullscreen}
                    className="flex flex-wrap items-center gap-3 text-sm"
                >
                    {/* The mark-learned shortcut lives in the header icon row; here we
                    only show the earned status and the review/backlog control. */}
                    {mastery?.learned && (
                        <>
                            <span className="inline-flex items-center gap-1 font-medium text-green-700 dark:text-green-400">
                                <CheckIcon className="h-4 w-4" /> {m.mastery_learned()}
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
                    )}
                </div>

                <FullScreen off>
                    <Show when={sharedFromLink}>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                            {m.ghost_shared_loaded()}
                        </p>
                    </Show>
                </FullScreen>

                <Show when={matcher.practicing}>
                    <div className={`space-y-2 ${fullscreen ? "shrink-0" : ""}`}>
                        {/* Full screen keeps only the score and the keys; its progress count
                        rides in the top bar, so this full-width status row is dropped. */}
                        <FullScreen off>
                            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                                <span className="text-gray-600 dark:text-gray-400">
                                    {m.play_progress()} {matcher.done} / {matcher.total}
                                </span>
                                <Midi supported>
                                    <Show when={!connected}>
                                        <Button variant="primary" onClick={requestAccess}>
                                            {status === "requesting"
                                                ? m.midi_connecting()
                                                : m.midi_connect()}
                                        </Button>
                                    </Show>
                                </Midi>
                                <Midi unsupported>
                                    <span className="text-xs text-gray-500 dark:text-gray-400">
                                        {m.midi_unsupported_keyboard()}
                                    </span>
                                </Midi>
                            </div>
                        </FullScreen>
                        <FullScreen off>
                            <Show when={ghost}>
                                <GhostTrack
                                    you={matcher.done}
                                    ghost={ghostDone}
                                    total={matcher.total}
                                />
                            </Show>
                        </FullScreen>
                        <FullScreen off>
                            <Show
                                when={
                                    compact &&
                                    portrait &&
                                    coarsePointer &&
                                    !connected &&
                                    !rotateDismissed
                                }
                            >
                                <div className="flex items-center justify-between gap-2 rounded-md bg-indigo-50 px-3 py-2 text-sm text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200">
                                    <span>{m.rotate_hint()}</span>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            localStorage.setItem("plinky:rotate-hint", "dismissed");
                                            setRotateDismissed(true);
                                        }}
                                        aria-label={m.action_dismiss()}
                                        className="shrink-0 p-1"
                                    >
                                        <CloseIcon className="h-4 w-4" />
                                    </button>
                                </div>
                            </Show>
                        </FullScreen>
                        {/* On a phone (portrait or landscape), a compact current-bars strip
                        right above the keys, so the notes to play aren't scrolled off
                        behind the keyboard; bigger screens — and full screen, where the
                        single score already fills the height — rely on the auto-scrolling
                        full score above. */}
                        <FullScreen off>
                            <Show when={compact}>
                                <FocusStrip
                                    xml={focusXml}
                                    bar={matcher.bar}
                                    label={m.focus_strip_label()}
                                />
                            </Show>
                        </FullScreen>
                        <Show when={!(fullscreen && hideKeyboard)}>
                            <PianoKeyboard
                                expected={hintNotes}
                                wrong={matcher.lastWrong}
                                from={keyWindow?.from}
                                to={keyWindow?.to}
                            />
                        </Show>
                    </div>
                </Show>

                {/* The grade narrows the type for the readouts below, so it stays an `&&`
                guard; the full-screen branch is the declarative half. */}
                <FullScreen off>
                    {grade && (
                        <div ref={gradePanelRef} className="space-y-3">
                            {milestone && <MilestoneBanner milestone={milestone} />}
                            {!ephemeral &&
                                (runSaved ? (
                                    <p className="text-sm text-green-700 dark:text-green-400">
                                        {m.takes_saved()}
                                    </p>
                                ) : (
                                    <div className="flex flex-wrap items-center gap-3">
                                        <span className="text-sm text-gray-600 dark:text-gray-400">
                                            {m.takes_save_prompt()}
                                        </span>
                                        <Button variant="primary" onClick={saveCurrentTake}>
                                            {m.takes_save()}
                                        </Button>
                                    </div>
                                ))}
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
                                    <dd className="text-right font-mono tabular-nums">
                                        {grade.accuracy}%
                                    </dd>
                                    <dt className="text-gray-500 dark:text-gray-400">
                                        {m.scores_timing()}
                                    </dt>
                                    <dd className="text-right font-mono tabular-nums">
                                        {grade.timing}%
                                    </dd>
                                    <dt className="text-gray-500 dark:text-gray-400">
                                        {m.scores_flow()}
                                    </dt>
                                    <dd className="text-right font-mono tabular-nums">
                                        {grade.flow}%
                                    </dd>
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
                            <PerformanceStrip notes={runNotes} tolerance={runTolerance} />
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
                                    rowLabels={[
                                        m.scores_accuracy(),
                                        m.scores_timing(),
                                        m.scores_flow(),
                                    ]}
                                    boast={
                                        daily != null
                                            ? m.daily_share_boast({
                                                  number: daily,
                                                  grade: grade.letter,
                                              })
                                            : m.share_boast({ title })
                                    }
                                    heading={
                                        daily != null ? `🎹 Plinky ${daily} ${grade.letter}` : title
                                    }
                                />
                            )}
                        </div>
                    )}
                </FullScreen>
                <FullScreen off>
                    {/* Challenge a friend with the run you just played, no save needed —
                    your own ghost, not a friend's loaded by link. */}
                    {storedGhost && !sharedFromLink && (
                        <div className="flex justify-end">
                            <ShareGhostButton
                                id={id}
                                title={title}
                                onsets={storedGhost}
                                label={m.takes_share_last_run()}
                                showLabel
                            />
                        </div>
                    )}
                    {takes.length > 0 && (
                        <TakesList
                            id={id}
                            takes={takes}
                            title={title}
                            activeReplayId={activeReplayId}
                            playing={playing}
                            onReplay={replayTake}
                            onStop={stopListen}
                            onDelete={deleteTake}
                        />
                    )}
                </FullScreen>
            </div>
        </FullscreenProvider>
    );
}
