// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { OpenSheetMusicDisplay } from "opensheetmusicdisplay";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMidiConnection, useMidiInput } from "../../contexts/midi";
import { FullScreen, FullscreenProvider, Midi, Show, useMidiConnected } from "./conditional";
import { useFullscreen } from "../../hooks/useFullscreen";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import { useMetronome } from "../../hooks/useMetronome";
import { usePref } from "../../hooks/usePref";
import { useKeepUp } from "../../hooks/useKeepUp";
import { useListenPlayback } from "../../hooks/useListenPlayback";
import { useGhostRace } from "../../hooks/useGhostRace";
import { type CorrectInfo, type Hand, useScoreMatcher } from "../../hooks/useScoreMatcher";
import { useSynth } from "../../hooks/useSynth";
import { annotateFingerings } from "../../lib/fingerScore";
import { cursorWhole, seekToWhole } from "../../lib/scoreCursor";
import { cadence } from "../../../core/cadence";
import { deriveRunOutcome, type TempoCurve } from "../../../core/runOutcome";
import {
    type RunCapture,
    captureCleared,
    captureRelease,
    liveTempo as nextLiveTempo,
    startCapture,
} from "../../../core/runCapture";
import { recordRun } from "../../lib/recordRun";
import type { DailyResult } from "../../../core/daily";
import type { Grade } from "../../../core/grade";
import { nextKeyboardWindow, type Span } from "../../../core/keyboardWindow";
import { useServices, useXmlCodec } from "../../contexts/services";
import { useMilestoneChannel } from "../../contexts/milestone";
import { compositionFromRun, type RunStep, type Take } from "../../../core/takes";
import { isPreciseInput } from "../../../core/midi";
import { PRECISE_TOLERANCE } from "../../../core/rhythm";
import {
    clearBarSelection,
    clientPointToSvg,
    collectMeasureBoxes,
    paintBarSelection,
    paintPlayedNotes,
} from "../../lib/scoreColor";
import { type MeasureBox, measureAtPoint } from "../../../core/scoreCanvas";
import type { Grid, RunNote } from "../../../core/shareCard";
import { transposeMusicXml } from "../../../core/transpose";
import { m } from "../../paraglide/messages.js";
import { Button, IconButton } from "../ui/button";
import { Drawer } from "../ui/drawer";
import { FocusStrip } from "./focusStrip";
import { GhostTrack } from "../ui/ghostTrack";
import { useTranspose } from "./transposeContext";
import { TakesPanel } from "./takesPanel";
import {
    CloseIcon,
    EyeIcon,
    HandIcon,
    ListIcon,
    PlayIcon,
    RotateIcon,
    SlidersIcon,
    StopIcon,
} from "../ui/icons";
import { PianoKeyboard } from "./pianoKeyboard";
import { PracticeToolsDrawer } from "./practiceToolsDrawer";
import { KeepUpResultCard } from "./keepUpResultCard";
import { LoopRangeBar } from "./loopRangeBar";
import { RunResult } from "./runResult";

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
    // Latches a completed run's grading so its side effects (history, lifetime,
    // ghost, mastery, daily, cadence) land exactly once. The completion effect
    // depends on inputs — like an onMastery callback the parent re-creates each
    // render — whose identity can churn while `matcher.complete` stays true; a
    // re-fire without this latch would double-count the run. Reset at run start.
    const gradedRef = useRef(false);
    const osmdRef = useRef<OpenSheetMusicDisplay | null>(null);
    const tempoRef = useRef(initialTempo ?? 100);
    // The run recorder (core/runCapture): the cleared notes' timing, the open key-holds,
    // the run clock's zero, and the imprecise-input flag. One ref, because the matcher
    // callback and the MIDI release handler both advance it between renders.
    const captureRef = useRef<RunCapture>(startCapture());
    const synth = useSynth();
    const [ready, setReady] = useState(false);
    const [loadError, setLoadError] = useState(false);
    // Tempo-enforced "keep up" mode: Practice runs at a fixed tempo, the cursor advancing
    // on the clock rather than waiting for you, so a note not cleared before it passes is a
    // miss. `guideNotes` sounds the notes as they pass for a follow-along; off, it's a
    // read-at-tempo test. Session toggles (not persisted), off by default.
    const [enforceTempo, setEnforceTempo] = useState(false);
    const [guideNotes, setGuideNotes] = useState(true);
    // This score's saved takes, and how the finished run's save went — "saved" and
    // "failed" both retire the save prompt, but only a landed write may claim success.
    const [takes, setTakes] = useState<Take[]>([]);
    const [runSaved, setRunSaved] = useState<"idle" | "saved" | "failed">("idle");
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
    // The last piece the reload effect seeded a loop for, so a relayout of the same
    // piece leaves the loop untouched while a genuinely new piece reseeds it.
    const loadedXmlRef = useRef<string | null>(null);
    // Each bar's rendered box, measured once per render, for placing the loop's red
    // selection overlay and mapping a click on the score to the bar under it.
    const measureBoxesRef = useRef<MeasureBox[]>([]);
    // The first bar of an in-progress click selection; the next click sets the far end.
    const selectAnchorRef = useRef<number | null>(null);
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
    // Bars forced onto each staff row (0 = fit to width), remembered per device.
    const services = useServices();
    // The fingering the player worked out for this piece (Fingering mode). When they
    // have some, the staff can show theirs instead of the app's suggestion — defaulting
    // to theirs, since they chose it on purpose.
    const saved = useMemo(() => services.fingering.load(id), [id, services.fingering]);
    const hasSaved = Object.keys(saved).length > 0;
    const [showMine, setShowMine] = useState(hasSaved);
    const { prefs: prefsStore } = services;
    const xmlCodec = useXmlCodec();
    const [barsPerRow, setBarsPerRow] = usePref(prefsStore, "barsPerRow");
    // Whether to number the first bar of each staff row, remembered per device.
    const [barNumbers, setBarNumbers] = usePref(prefsStore, "barNumbers");
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
    // Whether the Practice-tools drawer (all the play settings) is open. Reachable
    // both at rest and in full screen — the drawer portals above the score.
    const [toolsOpen, setToolsOpen] = useState(false);
    // Whether the Runs drawer (your saved performances of this piece) is open.
    const [runsOpen, setRunsOpen] = useState(false);
    // The slice of keyboard on show. A wide-ranging piece would shrink every key to a
    // sliver if framed whole, so the keyboard tracks a bounded window that follows the
    // notes being played; the player picks its width (or 0 to keep the whole piece in
    // view, fixed). Changing it re-frames from scratch (clear the remembered window).
    const [keyWindow, setKeyWindow] = useState<Span | null>(null);
    const [keyboardOctaves, setKeyboardOctaves] = usePref(prefsStore, "keyboardOctaves");
    const keyboardSpan = keyboardOctaves === 0 ? Number.POSITIVE_INFINITY : keyboardOctaves * 12;
    // Render the piece as one horizontal line that scrolls under a fixed gaze, instead of
    // wrapping into rows — the "treadmill" reading mode. Off by default.
    const [treadmill, setTreadmill] = usePref(prefsStore, "treadmill");
    const [raceGhost, setRaceGhost] = usePref(prefsStore, "raceGhost");
    // Print the suggested fingering numbers on the staff. Seeded from the saved default
    // (off), flipped live by the in-play toggle. The numbers are always baked into the
    // loaded sheet; the toggle only flips whether OSMD draws them, applied with a re-render
    // (not a reload) so it can go on and off mid-play without tearing down a run. The ref
    // carries the live value into the render's constructor when another input reloads.
    const [showFingerings, setShowFingerings] = useState(() => prefsStore.load().showFingerings);
    const showFingeringsRef = useRef(showFingerings);
    showFingeringsRef.current = showFingerings;
    // Whether the staff scrolls to keep the played note in view. On by default; the
    // treadmill drives its own centring, so OSMD's follow is off there. Applied straight to
    // OSMD (no reload), so the ref carries the live value into the render's constructor.
    const [scrollFollow, setScrollFollow] = useState(true);
    const scrollFollowRef = useRef(true);
    scrollFollowRef.current = scrollFollow;
    // A once-dismissible nudge to turn a touch phone sideways for a wider keyboard, only
    // when it would actually help (portrait, no MIDI). Read after mount to avoid a
    // hydration mismatch; the portrait layout stays fully usable, so this never forces
    // an orientation (WCAG 1.3.4).
    const [rotateDismissed, setRotateDismissed] = useState(false);
    useEffect(() => {
        setRotateDismissed(services.store.get("plinky:rotate-hint") === "dismissed");
    }, [services.store]);
    // The notation the mobile focus strip shows — transposed to match what's played,
    // but un-annotated (it's for reading the bar, not the printed fingering).
    const focusXml = useMemo(
        () => (transpose === 0 ? xml : transposeMusicXml(xmlCodec, xml, transpose)),
        [xml, transpose, xmlCodec],
    );
    // Which hand to practice, and the score's staff count — the hands-separate
    // selector only appears for the grand-staff (two-staff) scores it applies to.
    const [hand, setHand] = useState<Hand>("both");
    const [staffCount, setStaffCount] = useState(1);

    const [grade, setGrade] = useState<Grade | null>(seededResult?.grade ?? null);
    const [runNotes, setRunNotes] = useState<RunNote[]>(seededResult?.notes ?? []);
    // The timing leniency the finished run was graded at, kept so the per-note strip
    // reads the same windows as the grade and share grid.
    const [runTolerance, setRunTolerance] = useState(seededResult?.tolerance ?? PRECISE_TOLERANCE);
    const [shareGrid, setShareGrid] = useState<Grid | null>(seededResult?.grid ?? null);
    // An earned moment (first S, grade-up, flawless run) is published to the app-wide
    // channel once the run's mastery is folded in, for the shell banner to celebrate. At
    // most one per run; cleared at the next run's start.
    const { publish: publishMilestone, dismiss: dismissMilestone } = useMilestoneChannel();
    const [tempoCurve, setTempoCurve] = useState<TempoCurve | null>(null);
    // The tempo a run was matched at, captured when practice starts so the run's
    // self-paced tempo curve reads against the same reference the matcher used,
    // even if the slider is moved afterwards.
    const runTempoRef = useRef(initialTempo ?? 100);
    // Whether any note has been coloured on the score, so a fresh run re-renders to
    // clear last run's progress only when there is something to clear.
    const paintedRef = useRef(false);
    // A run that began partway through — taking over from Listen, or resuming where a
    // stopped run left off. It is graded for what was played, but keeps no ghost: a
    // partial replay would strand the next race at its early end, and chasing a
    // full-piece ghost from the middle is meaningless.
    const partialRunRef = useRef(false);

    // The cursor's current position in whole notes — the shared place Listen and
    // Practice hand off at, so switching between them (or leaving and re-entering the
    // play surface) continues here rather than rewinding.
    const resumePoint = () => cursorWhole(osmdRef.current?.cursor);

    // Load this score's saved takes; a new score swaps in its own.
    useEffect(() => {
        setTakes(services.takes.list(id));
    }, [id, services.takes.list]);

    const getOsmd = useCallback(() => osmdRef.current, []);

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

    // Tempo-locked play-along ("keep up"): the clock advances the cursor and scores each
    // beat; finishing drops out of full screen so the result comes into view.
    const readTempo = useCallback(() => tempoRef.current, []);
    const keepUp = useKeepUp({
        getOsmd,
        synth,
        tempo: readTempo,
        beatsPerBar: beatsPerBar ?? 4,
        centerCursor,
        onFinish: exitFullscreen,
    });

    // A metronome on demand: fixed at the chosen tempo, or following the player's
    // own pace when adaptive.
    // Keep-up mode always ticks (a count-in then the beat you're racing), whatever the
    // metronome toggle; a self-paced run honours the toggle.
    useMetronome(
        metronomeOn || keepUp.running,
        keepUp.running ? tempo : adaptive ? liveTempo : tempo,
        beatsPerBar ?? 4,
        keepUp.running ? 1 : subdivision,
    );

    // Keep-going mode, remembered across pieces; captured by the matcher at run start.
    const [forgiving, setForgiving] = usePref(prefsStore, "forgiving");
    const matcher = useScoreMatcher(getOsmd, {
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
            // Record the cleared note — its ideal and actual timing, and a hold per
            // pitch for the release to close — for the grade, the per-note strip, the
            // share grid and the saved take.
            captureCleared(captureRef.current, info);
            // Ease the adaptive metronome toward the player's own pace, read from the
            // gap between the last two notes.
            setLiveTempo((prev) => nextLiveTempo(captureRef.current, runTempoRef.current, prev));
        },
    });
    useMidiInput({
        onNoteOn: (event) => {
            // A play-along run owns the input: notes are caught against the clock, not fed
            // to the self-paced matcher.
            if (keepUp.active()) {
                keepUp.registerNote(event.note);
                return;
            }
            if (!isPreciseInput(event.device)) {
                captureRef.current.imprecise = true;
            }
            matcher.registerNote(event.note, event.timestamp, event.velocity);
        },
        // A released key fills in the run note's real hold length. Only a precise device
        // (a MIDI piano) reports a meaningful hold; on-screen and computer-keyboard input
        // are left to the smoother onset-gap length so a quick tap doesn't read as staccato.
        onNoteOff: (event) => {
            if (!isPreciseInput(event.device)) {
                return;
            }
            captureRelease(captureRef.current, event.note, event.timestamp);
        },
    });
    const { status, requestAccess } = useMidiConnection();
    const connected = useMidiConnected();

    // The ghost race — a previous run replayed against the clock on the staff and the
    // race track. Armed at run start; the run clock's zero is the capture's startedAt.
    const runStartedAt = useCallback(() => captureRef.current.startedAt, []);
    const ghostRace = useGhostRace({
        id,
        canShareGhost,
        getOsmd,
        practicing: matcher.practicing,
        complete: matcher.complete,
        done: matcher.done,
        runStartedAt,
    });

    // The listening transport — Listen and take-replay share one cursor walk, one
    // clock, one stop. It reads the loop range and tempo live, marks the score as
    // painted when its trail lands, and leaves the cursor shown if the matcher owns it.
    const readLoop = useCallback(() => loopRef.current, []);
    const markPainted = useCallback(() => {
        paintedRef.current = true;
    }, []);
    const isPracticing = useCallback(() => matcher.practicing, [matcher.practicing]);
    const listenPlayback = useListenPlayback({
        getOsmd,
        synth,
        tempo: readTempo,
        loop: readLoop,
        onLap: bumpTempo,
        centerCursor,
        markPainted,
        isPracticing,
    });

    // Fill the selected loop bars with the red overlay (or clear it when the loop is off),
    // reading the live range from loopRef so the callback stays stable. Re-run after each
    // render and whenever the range changes.
    const paintLoopSelection = useCallback(() => {
        const svg = containerRef.current?.querySelector("svg");
        if (!(svg instanceof SVGSVGElement)) {
            return;
        }
        if (loopRef.current.on) {
            paintBarSelection(
                svg,
                measureBoxesRef.current,
                loopRef.current.from - 1,
                loopRef.current.to - 1,
            );
        } else {
            clearBarSelection(svg);
        }
    }, []);

    // Click a bar to build the loop range: the first click drops the anchor (a one-bar
    // loop), the next extends to the far end. Only while set-up, not mid-play, and the
    // number inputs remain the keyboard-accessible way in.
    const selectBarAt = useCallback(
        (clientX: number, clientY: number) => {
            if (matcher.practicing || listenPlayback.active() || measureCount <= 1) {
                return;
            }
            const svg = containerRef.current?.querySelector("svg");
            if (!(svg instanceof SVGSVGElement) || measureBoxesRef.current.length === 0) {
                return;
            }
            const point = clientPointToSvg(svg, clientX, clientY);
            const measure = measureAtPoint(measureBoxesRef.current, point.x, point.y);
            if (measure === null) {
                return;
            }
            const bar = measure + 1;
            if (selectAnchorRef.current === null) {
                selectAnchorRef.current = bar;
                setLoopOn(true);
                setLoopFrom(bar);
                setLoopTo(bar);
            } else {
                setLoopFrom(Math.min(selectAnchorRef.current, bar));
                setLoopTo(Math.max(selectAnchorRef.current, bar));
                selectAnchorRef.current = null;
            }
        },
        [matcher.practicing, measureCount, listenPlayback.active],
    );

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

    // Keep the red loop overlay in step with the range and each fresh render (ready is the
    // signal that the boxes were just re-measured). paintLoopSelection reads the live range
    // from a ref, so these are triggers, not closure inputs.
    // biome-ignore lint/correctness/useExhaustiveDependencies: the loop state and ready are re-paint triggers, not inputs
    useEffect(() => {
        paintLoopSelection();
    }, [loopOn, loopFrom, loopTo, ready, paintLoopSelection]);

    // Grade a run once it completes, from the captured timing and velocity. A run
    // with no real velocity variation (the computer keyboard) is graded without
    // dynamics rather than crediting a constant. Timing is judged against the
    // player's own pace (so a steady run at any tempo reads as in time) with windows
    // widened for imprecise input (on-screen / computer keyboard).
    useEffect(() => {
        if (!matcher.complete || gradedRef.current) {
            return;
        }
        gradedRef.current = true;
        const notes = captureRef.current.notes;
        // Everything the finished run shows and records — the grade, the timing tolerance,
        // the per-hand share grid and the tempo curve — is a pure function of the played
        // notes. The component only produces the run; deriveRunOutcome scores it.
        const {
            grade: result,
            tolerance,
            grid,
            tempoCurve,
        } = deriveRunOutcome({
            notes,
            correct: matcher.total,
            wrong: matcher.wrong,
            imprecise: captureRef.current.imprecise,
            intendedTempo: initialTempo ?? runTempoRef.current,
            runTempo: runTempoRef.current,
        });
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
        setTempoCurve(tempoCurve);
        // React to the finished run: record it in every store that remembers a run and
        // surface any earned moment. The component only produces the run; recordRun writes
        // it. It hands back the onsets when they become this score's new ghost, so the
        // share button's mirror can follow.
        const { ghost: newGhost } = recordRun(
            {
                id,
                title,
                daily,
                ephemeral,
                partial: partialRunRef.current,
                notes,
                correct: matcher.total,
                grade: result,
                grid,
                tolerance,
            },
            services,
            Date.now(),
            publishMilestone,
        );
        if (newGhost) {
            ghostRace.adoptOwnRun(newGhost);
        }
        if (!ephemeral) {
            onMastery?.();
        }
    }, [
        matcher.complete,
        matcher.total,
        matcher.wrong,
        id,
        title,
        onMastery,
        ephemeral,
        daily,
        initialTempo,
        bumpTempo,
        synth,
        services,
        publishMilestone,
        ghostRace.adoptOwnRun,
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

    // Leaving the play surface — the ✕, Esc, or a finished run dropping out — ends any
    // run in progress, but keeps the cursor where it is (stop hides, never rewinds), so
    // re-entering Practice or Listen picks up from the same place. A run that finished on
    // its own has already stopped; this covers stepping out mid-run.
    // biome-ignore lint/correctness/useExhaustiveDependencies: stopListen/stopKeepUp/matcher.stop reset transient playback, not render inputs
    useEffect(() => {
        if (!fullscreen) {
            listenPlayback.stop();
            // A tempo-locked play-along drives the cursor from its own timers and funnels
            // every note into the run; without tearing it down here, leaving full screen
            // freezes it mid-run and strands note input until Stop.
            keepUp.stop();
            matcher.stop();
        }
    }, [fullscreen]);

    // Reload OSMD whenever the score changes, and stop any playback/practice — a
    // tempo-locked play-along included, or a layout change mid-run would strand its
    // running state (the Stop label, the ticking metronome) with the timers gone.
    // biome-ignore lint/correctness/useExhaustiveDependencies: matcher.stop/stopListen/stopKeepUp reset transient playback, not render inputs
    useEffect(() => {
        let cancelled = false;
        setReady(false);
        setLoadError(false);
        paintedRef.current = false;
        listenPlayback.stop();
        keepUp.stop();
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
                    followCursor: scrollFollowRef.current && !treadmill,
                    // One continuous horizontal staffline that scrolls right, rather than
                    // wrapping into rows — the treadmill reading mode.
                    renderSingleHorizontalStaffline: treadmill,
                });
                osmdRef.current = osmd;
                const rules = (
                    osmd as unknown as {
                        rules: {
                            RenderXMeasuresPerLineAkaSystem: number;
                            RenderMeasureNumbers: boolean;
                            RenderMeasureNumbersOnlyAtSystemStart: boolean;
                            RenderFingerings: boolean;
                        };
                    }
                ).rules;
                // Force a fixed number of bars per row when the player picks one, for
                // bigger, more readable notation on a small screen; 0 fits them to width.
                rules.RenderXMeasuresPerLineAkaSystem = barsPerRow;
                // Number the first bar of each row when bar numbers are on, so the same
                // rows are labelled every render; OSMD's default cadence otherwise moves
                // the numbers around as the score re-flows.
                rules.RenderMeasureNumbers = barNumbers;
                rules.RenderMeasureNumbersOnlyAtSystemStart = true;
                // Whether the printed fingering is drawn. The numbers are always baked into
                // the sheet below, so flipping this rule and re-rendering shows or hides them
                // without a reload — see the fingering-toggle effect. Set from a ref so a
                // reload driven by another input still honours the live toggle.
                rules.RenderFingerings = showFingeringsRef.current;
                // Suggested fingering belongs on the staff, personalised to the player's
                // reach, so the suggestion sits on the note being read, not mapped onto a
                // key. Transpose first, then annotate, so the printed fingering is computed
                // for the key actually being played. It is always baked in — drawn or not
                // per the rule above — so the toggle can redraw rather than reload.
                const transposed =
                    transpose === 0 ? xml : transposeMusicXml(xmlCodec, xml, transpose);
                const source = annotateFingerings(
                    xmlCodec,
                    transposed,
                    prefsStore.load().handSpan,
                    showMine ? saved : undefined,
                );
                return osmd.load(source).then(() => {
                    if (!cancelled) {
                        osmd.render();
                        // Measure every bar's box off the fresh render, for the loop's
                        // selection overlay and click-to-select. The cursor is free here
                        // (nothing is playing), and a fresh render carries no selection.
                        const svg = containerRef.current?.querySelector("svg");
                        measureBoxesRef.current =
                            svg instanceof SVGSVGElement ? collectMeasureBoxes(osmd, svg) : [];
                        selectAnchorRef.current = null;
                        // A grand staff (two staves) can be drilled one hand at a
                        // time; a single-staff score offers no such choice.
                        setStaffCount(osmd.Sheet?.getCompleteNumberOfStaves() ?? 1);
                        setHand("both");
                        const bars = osmd.Sheet?.SourceMeasures?.length ?? 1;
                        setMeasureCount(bars);
                        // A bar range stays valid across a relayout (bars-per-row,
                        // treadmill, fingering, transpose all keep the same bars), so
                        // the loop resets only when the piece itself changes — that is
                        // what keeps treadmill and loop independent. On a fresh piece
                        // it seeds to the whole song, the default loop.
                        if (loadedXmlRef.current !== xml) {
                            loadedXmlRef.current = xml;
                            setLoopFrom(1);
                            setLoopTo(bars);
                            setLoopOn(false);
                        }
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
            // The effect body stops every playback mode before loading; the timer chains
            // also clear themselves on unmount, so nothing here can fire into a torn-down
            // score. A change of layout (bars-per-row, treadmill, transpose) re-runs this
            // effect, building a fresh OSMD on the same container. OSMD renders into a
            // new SVG rather than replacing the old one, so without removing the previous
            // render its SVG stays behind and each switch stacks another copy. clear()
            // frees OSMD's own state but leaves its <svg> in the DOM, so empty the
            // container too.
            osmdRef.current?.clear();
            containerRef.current?.replaceChildren();
        };
    }, [xml, transpose, showMine, saved, barsPerRow, barNumbers, treadmill]);

    // Toggle the on-staff fingering without re-parsing the MusicXML, so the loaded sheet
    // and any run in progress survive — the player can switch fingering on and off mid-play.
    // The numbers are always baked into the loaded sheet; flipping OSMD's RenderFingerings
    // rule alone isn't enough, because a bare render() repositions the cached fingering
    // labels but never destroys them, leaving stale numbers over the reclaimed space when
    // switching off. updateGraphic() rebuilds the graphic model from the parsed sheet, so
    // the labels are created afresh per the rule — all when on, none when off. The reload
    // effect sets the rule to the live toggle on every fresh render, so this acts only on a
    // real change and never fires a redundant rebuild straight after a reload.
    useEffect(() => {
        const osmd = osmdRef.current;
        if (!osmd || !ready) {
            return;
        }
        const rules = (osmd as unknown as { rules: { RenderFingerings: boolean } }).rules;
        if (rules.RenderFingerings === showFingerings) {
            return;
        }
        rules.RenderFingerings = showFingerings;
        // Remember where the cursor stands and whether a run or Listen is driving it, so it
        // resumes on the same note: updateGraphic() re-initialises the cursor to the start.
        const cursor = osmd.cursor;
        const wasVisible = !cursor.hidden;
        const at = cursor.iterator?.currentTimeStamp?.RealValue ?? 0;
        osmd.updateGraphic();
        osmd.render();
        // A fresh render carries no measure boxes or overlay: re-measure the bars for the
        // loop selection and click-to-select, repaint the overlay, and drop the paint flag.
        const svg = containerRef.current?.querySelector("svg");
        measureBoxesRef.current =
            svg instanceof SVGSVGElement ? collectMeasureBoxes(osmd, svg) : [];
        paintedRef.current = false;
        // Step the reset cursor back to where it stood — OSMD has no direct seek — and show
        // it again where a run or Listen was using it, re-centring the treadmill.
        if (wasVisible) {
            seekToWhole(cursor, at);
            cursor.show();
            centerCursor();
        }
        paintLoopSelection();
    }, [showFingerings, ready, centerCursor, paintLoopSelection]);

    // Start Listen: the play surface goes full screen, any self-paced run stops, and
    // the transport walks the cursor from wherever it sits — the note Practice was on
    // when handing over, or where a paused run left off — instead of rewinding, so play
    // can pass back and forth without losing the place.
    const listen = () => {
        if (listenPlayback.active() || keepUp.active()) {
            return;
        }
        const from = resumePoint();
        enterPlayFullscreen();
        matcher.stop();
        listenPlayback.start(from);
    };

    // Start a tempo-locked play-along: the play surface goes full screen, any
    // self-paced run stops, last run's colours wipe, and the keep-up clock takes
    // over — scoring only the practised hand, exactly as self-paced practice does.
    const playAlong = () => {
        const osmd = osmdRef.current;
        if (!osmd || listenPlayback.active() || keepUp.active()) {
            return;
        }
        enterPlayFullscreen();
        matcher.stop();
        if (paintedRef.current) {
            osmd.render();
            paintedRef.current = false;
        }
        keepUp.start({ hand: staffCount < 2 ? "both" : hand, guideNotes });
    };

    // Save the just-finished run as a take: rebuild a Composition from the captured
    // steps (their played onsets, pitches and velocity) and store it under this song.
    const saveCurrentTake = () => {
        const steps: RunStep[] = captureRef.current.notes.map((note) => ({
            pitches: note.pitches,
            startMs: note.playedMs,
            velocity: note.velocity,
            heldMs: note.heldMs,
        }));
        if (steps.length === 0) {
            return;
        }
        const take: Take = {
            id: crypto.randomUUID(),
            createdAt: Date.now(),
            letter: grade?.letter ?? "",
            complete: matcher.complete,
            metrics: grade ?? null,
            composition: compositionFromRun(steps, tempo, beatsPerBar ?? 4),
        };
        const saved = services.takes.save(id, take);
        setTakes(saved.takes);
        setRunSaved(saved.stored ? "saved" : "failed");
    };

    // Replay a saved take: any Listen in progress hands the transport over, and the
    // self-paced matcher stops so the replay owns the cursor.
    const replayTake = (take: Take) => {
        matcher.stop();
        listenPlayback.replay(take);
    };

    const deleteTake = (takeId: string) => {
        if (listenPlayback.activeReplayId === takeId) {
            listenPlayback.stop();
        }
        // The returned list is what storage really holds — a refused rewrite keeps
        // the take, and the list keeps showing it instead of resurrecting it later.
        setTakes(services.takes.remove(id, takeId).takes);
    };

    // Playing goes full screen on every device. The play surface holds controls that live
    // only there — Listen, the finger-number and follow-the-note toggles, the on-staff
    // exit — so the run needs the room whatever the screen size, and a large display is no
    // exception. On a phone it also reclaims the browser chrome (the URL bar) that the
    // keyboard would otherwise crowd out.
    const enterPlayFullscreen = () => {
        if (!fullscreen) {
            enterFullscreen();
        }
    };

    const practice = (resume = true) => {
        // Take over at the cursor's current position when resuming (handing over from
        // Listen, or continuing a run stopped partway); Restart passes resume=false to
        // begin at the top. The top of a fresh piece reads as 0 either way.
        const from = resume ? resumePoint() : 0;
        const partial = from > 0;
        partialRunRef.current = partial;
        enterPlayFullscreen();
        listenPlayback.stop();
        setRunSaved("idle");
        // A fresh recorder also zeroes the run clock, so the ghost tick's startedAt
        // guard holds until the run's first note arrives — a stale start timestamp
        // would paint the ghost at the finish the moment Practice is pressed.
        captureRef.current = startCapture();
        gradeFromRunRef.current = false;
        gradedRef.current = false;
        setGrade(null);
        setRunNotes([]);
        setShareGrid(null);
        dismissMilestone();
        setTempoCurve(null);
        keepUp.clearResult();
        setLiveTempo(tempo);
        runTempoRef.current = tempo;
        // The hand the matcher and the ghost step through: the whole grand staff
        // when there's a single staff, otherwise the hand being drilled. (Fingering
        // is printed on the staff at load time, not computed per run.)
        const matcherHand: Hand = staffCount < 2 ? "both" : hand;
        // A fresh run from the top wipes the previous run's colours for a clean slate; a
        // resumed run (taking over from Listen) keeps them, so the blue Listen trail and
        // any earlier green survive and the score shows how the whole piece was played.
        if (!partial && paintedRef.current) {
            osmdRef.current?.render();
            paintedRef.current = false;
        }
        // Arm the ghost race post-render, so its marker moves along the freshly drawn notes.
        ghostRace.arm({ partial, ephemeral, raceGhost, hand: matcherHand });
        matcher.start(from);
    };

    // Reveal the next note by colour per the player's hint setting — always, only
    // once they've slipped at this position, or never. A wrong key flashes red
    // regardless, so a miss is always felt.
    const noteHints = prefsStore.load().noteHints;
    const hintNotes =
        noteHints === "always" || (noteHints === "miss" && matcher.missedHere)
            ? matcher.expected
            : [];

    // Which hand trailed the other on a two-hand run (null on a single-hand one), read at
    // the same tempo scale as the shared grid so the readout matches its rows. Only
    // meaningful once a run is graded.
    // The run's tempo re-referenced to the piece's own, so the results panel reads the
    // lagging hand at the same scale the share grid was built with.
    const intendedTempo = initialTempo ?? runTempoRef.current;
    const runTempoScale = intendedTempo > 0 ? runTempoRef.current / intendedTempo : 1;

    // Listen lives only in the full-screen top bar. Playing enters full screen on every
    // device, so that is the one place it's reachable — which keeps the inline /play view to
    // a single primary action (Practice), the piece's front door.
    const listenButton = (
        <Button
            variant="secondary"
            disabled={!ready || keepUp.running}
            onClick={() => (listenPlayback.playing ? listenPlayback.stop() : listen())}
        >
            {listenPlayback.playing ? <StopIcon /> : <PlayIcon />}
            {listenPlayback.playing ? m.action_listen_stop() : m.action_listen()}
        </Button>
    );
    // Practice is the screen's primary action, so it carries the dominant filled variant.
    // It enters full screen first, then starts the run; with "keep up" on it starts a
    // tempo-locked play-along instead of the self-paced run.
    const practiceButton = (
        <Button
            variant="primary"
            disabled={!ready}
            onClick={() => {
                if (matcher.practicing) {
                    matcher.stop();
                } else if (keepUp.running) {
                    keepUp.stop();
                } else if (enforceTempo) {
                    playAlong();
                } else {
                    practice();
                }
            }}
        >
            {matcher.practicing || keepUp.running ? m.action_listen_stop() : m.action_practice()}
        </Button>
    );
    // Opens the Practice-tools drawer. A sliders icon, deliberately not a gear — the
    // header gear is the app's global /settings, these are the per-piece knobs.
    const toolsButton = (
        <Button variant="secondary" onClick={() => setToolsOpen(true)}>
            <SlidersIcon />
            {m.more_options()}
        </Button>
    );
    // Opens the Runs drawer: your saved performances of this piece. Kept out of the main
    // column so browsing them, sharing your last run, or replaying one never clutters the
    // resting play view. Not for an ephemeral piece, which can't be saved.
    const runsButton = !ephemeral && (
        <Button variant="secondary" onClick={() => setRunsOpen(true)}>
            <ListIcon />
            {m.takes_button()}
        </Button>
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
                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                        {listenButton}
                        {practiceButton}
                        <Show when={matcher.practicing}>
                            <span className="text-sm tabular-nums text-gray-600 dark:text-gray-400">
                                {matcher.done}/{matcher.total}
                            </span>
                        </Show>
                        <Show when={keepUp.running}>
                            <span className="text-sm tabular-nums text-gray-600 dark:text-gray-400">
                                {keepUp.progress.inTime}/{keepUp.progress.done}
                            </span>
                        </Show>
                        {/* Restart the run — a practice-only action, so it's absent while
                        just listening. */}
                        <Show when={matcher.practicing}>
                            <IconButton onClick={() => practice(false)} label={m.action_restart()}>
                                <RotateIcon />
                            </IconButton>
                        </Show>
                        {/* Show/hide the fingering numbers on the staff without leaving the
                        music — seeded from the setting, flipped here for this session. */}
                        <IconButton
                            onClick={() => setShowFingerings((on) => !on)}
                            aria-pressed={showFingerings}
                            label={m.action_finger_numbers()}
                            className={showFingerings ? "text-indigo-600 dark:text-indigo-400" : ""}
                        >
                            <HandIcon />
                        </IconButton>
                        {/* Turn the follow-the-note scrolling off to read at your own pace,
                        or on to let the staff keep up. Moot in treadmill, which scrolls
                        itself. */}
                        <Show when={!treadmill}>
                            <IconButton
                                onClick={() => {
                                    const next = !scrollFollow;
                                    setScrollFollow(next);
                                    const osmd = osmdRef.current;
                                    if (osmd) {
                                        osmd.FollowCursor = next;
                                    }
                                }}
                                aria-pressed={scrollFollow}
                                label={m.action_scroll_follow()}
                                className={
                                    scrollFollow ? "text-indigo-600 dark:text-indigo-400" : ""
                                }
                            >
                                <EyeIcon />
                            </IconButton>
                        </Show>
                        {/* The Practice-tools drawer — tempo, loop, metronome, keep-up and
                        the rest — reachable without leaving full screen. */}
                        <IconButton onClick={() => setToolsOpen(true)} label={m.more_options()}>
                            <SlidersIcon />
                        </IconButton>
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
                            <CloseIcon />
                        </IconButton>
                    </div>
                </FullScreen>
                {/* Inline, a single primary action sits above the score so it's the first
                thing in reach — Practice enters full screen and starts the run. Listen and
                the rest of the transport live in the full-screen top bar (above), reachable
                once play begins, so the resting /play view stays uncluttered. */}
                <FullScreen off>
                    <div className="flex flex-wrap items-center gap-3">
                        {practiceButton}
                        {toolsButton}
                        {runsButton}
                    </div>
                </FullScreen>
                {/* When the loop is on, its range and narrowing controls sit right by the
                score — the drawer's backdrop covers the score, so narrowing happens here,
                drawer closed. Hidden during a run, when the score isn't yours to click. */}
                {ready && measureCount > 1 && loopOn && !matcher.practicing && !keepUp.running && (
                    <LoopRangeBar
                        measureCount={measureCount}
                        from={loopFrom}
                        to={loopTo}
                        setFrom={setLoopFrom}
                        setTo={setLoopTo}
                        onWholeSong={() => {
                            selectAnchorRef.current = null;
                            setLoopFrom(1);
                            setLoopTo(measureCount);
                        }}
                    />
                )}
                {/* OSMD renders to its container's full offset width, which includes any
                border or padding on that element; were either on the element OSMD owns, the
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
                    {/* Click a bar to build the loop range; the loop from/to number inputs
                    are the keyboard-accessible equivalent, so no key handler is needed. */}
                    {/* biome-ignore lint/a11y/useKeyWithClickEvents: the loop from/to number inputs are the keyboard path */}
                    <div
                        ref={containerRef}
                        // biome-ignore lint/a11y/noNoninteractiveTabindex: a scrollable region needs keyboard access
                        tabIndex={0}
                        role="img"
                        aria-label={title}
                        onClick={(event) => selectBarAt(event.clientX, event.clientY)}
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
                            ready &&
                            measureCount > 1 &&
                            !listenPlayback.playing &&
                            !matcher.practicing
                                ? "cursor-pointer"
                                : ""
                        } ${
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

                {/* All play settings live in one drawer, opened by the Practice-tools
                button (at rest and in the full-screen transport) and portaled above the
                score — so the resting view stays uncluttered and the settings are reachable
                mid-play, not stranded in a fold that vanishes in full screen. */}
                <PracticeToolsDrawer
                    open={toolsOpen}
                    onClose={() => setToolsOpen(false)}
                    lockTempo={lockTempo}
                    tempo={tempo}
                    setTempo={setTempo}
                    trainerOn={trainerOn}
                    setTrainerOn={setTrainerOn}
                    trainerTarget={trainerTarget}
                    setTrainerTarget={setTrainerTarget}
                    metronomeOn={metronomeOn}
                    setMetronomeOn={setMetronomeOn}
                    adaptive={adaptive}
                    setAdaptive={setAdaptive}
                    liveTempo={liveTempo}
                    subdivision={subdivision}
                    setSubdivision={setSubdivision}
                    enforceTempo={enforceTempo}
                    setEnforceTempo={setEnforceTempo}
                    guideNotes={guideNotes}
                    setGuideNotes={setGuideNotes}
                    forgiving={forgiving}
                    setForgiving={setForgiving}
                    raceGhost={raceGhost}
                    setRaceGhost={setRaceGhost}
                    staffCount={staffCount}
                    hand={hand}
                    setHand={setHand}
                    practicing={matcher.practicing}
                    loopAvailable={ready && measureCount > 1}
                    loopOn={loopOn}
                    onToggleLoop={(next) => {
                        selectAnchorRef.current = null;
                        // Activating the loop repeats the whole piece by default — the
                        // common case — so narrowing to a passage (click two bars on the
                        // score) stays optional.
                        if (next) {
                            setLoopFrom(1);
                            setLoopTo(measureCount);
                        }
                        setLoopOn(next);
                    }}
                    showTranspose={!lockTempo}
                    transpose={transpose}
                    setTranspose={setTranspose}
                    showMineAvailable={hasSaved && showFingerings}
                    showMine={showMine}
                    setShowMine={setShowMine}
                    treadmill={treadmill}
                    setTreadmill={setTreadmill}
                    barNumbers={barNumbers}
                    setBarNumbers={setBarNumbers}
                    barsPerRow={barsPerRow}
                    setBarsPerRow={setBarsPerRow}
                    keyboardOctaves={keyboardOctaves}
                    onKeyboardOctaves={(n) => {
                        // Re-frame the keyboard window from scratch when the octave count
                        // changes; usePref persists the choice.
                        setKeyboardOctaves(n);
                        setKeyWindow(null);
                    }}
                />

                <FullScreen off>
                    <Show when={ghostRace.sharedFromLink}>
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
                        {/* The race track rides along in full screen too — a thin bar below
                        the score — so racing a ghost survives the move to always-full-screen
                        play; without it the race would be invisible whenever you play. */}
                        <Show when={ghostRace.ghost}>
                            <GhostTrack
                                you={matcher.done}
                                ghost={ghostRace.ghostDone}
                                total={matcher.total}
                            />
                        </Show>
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
                                            services.store.set("plinky:rotate-hint", "dismissed");
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

                {/* The play-along result — how many beats you kept up with — shown when a
                tempo-locked run finishes, in place of the self-paced grade panel. */}
                <FullScreen off>
                    {keepUp.result && <KeepUpResultCard result={keepUp.result} />}
                </FullScreen>
                {/* The grade narrows the type for the readouts below, so it stays an `&&`
                guard; the full-screen branch is the declarative half. */}
                <FullScreen off>
                    {grade && (
                        <div ref={gradePanelRef} className="space-y-3">
                            <RunResult
                                grade={grade}
                                notes={runNotes}
                                tolerance={runTolerance}
                                grid={shareGrid}
                                tempoCurve={tempoCurve}
                                tempoScale={runTempoScale}
                                daily={daily}
                                title={title}
                                ephemeral={ephemeral}
                                runSaved={runSaved}
                                onSaveTake={saveCurrentTake}
                            />
                        </div>
                    )}
                </FullScreen>
                {/* Your saved performances of this piece live in their own drawer — sharing
                your last run, replaying or racing an old one — so browsing them never
                clutters the resting play column. The drawer's count-titled header stands in
                for a section heading; replaying one closes the drawer so the score behind it
                is in view. Not for an ephemeral piece, which can't be saved. */}
                {!ephemeral && (
                    <Drawer
                        open={runsOpen}
                        onClose={() => setRunsOpen(false)}
                        title={
                            takes.length > 0
                                ? m.takes_heading({ count: takes.length })
                                : m.takes_panel_heading()
                        }
                    >
                        <TakesPanel
                            id={id}
                            takes={takes}
                            title={title}
                            activeReplayId={listenPlayback.activeReplayId}
                            playing={listenPlayback.playing}
                            lastRunOnsets={ghostRace.storedGhost}
                            canShareLastRun={!ghostRace.sharedFromLink}
                            onReplay={(take) => {
                                setRunsOpen(false);
                                replayTake(take);
                            }}
                            onStop={listenPlayback.stop}
                            onDelete={deleteTake}
                        />
                    </Drawer>
                )}
            </div>
        </FullscreenProvider>
    );
}
