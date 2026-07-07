// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMidiConnection, useMidiInput } from "../../contexts/midi";
import { FullScreen, FullscreenProvider, Midi, Show, useMidiConnected } from "./conditional";
import { useFullscreen } from "../../hooks/useFullscreen";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import { useMetronome } from "../../hooks/useMetronome";
import { usePref } from "../../hooks/usePref";
import { useTempoControls } from "../../hooks/useTempoControls";
import { useOsmdScore } from "../../hooks/useOsmdScore";
import { useLoopSelection } from "../../hooks/useLoopSelection";
import { useKeepUp } from "../../hooks/useKeepUp";
import { useListenPlayback } from "../../hooks/useListenPlayback";
import { useRunResult } from "../../hooks/useRunResult";
import { useGhostRace } from "../../hooks/useGhostRace";
import { type CorrectInfo, type Hand, useScoreMatcher } from "../../hooks/useScoreMatcher";
import { useSynth } from "../../hooks/useSynth";
import { cursorWhole } from "../../lib/scoreCursor";
import { cadence } from "../../../core/cadence";
import { deriveRunOutcome } from "../../../core/runOutcome";
import {
    type RunCapture,
    captureCleared,
    captureRelease,
    startCapture,
} from "../../../core/runCapture";
import { recordRun } from "../../lib/recordRun";
import type { DailyResult } from "../../../core/daily";
import { nextKeyboardWindow, type Span } from "../../../core/keyboardWindow";
import { useServices, useXmlCodec } from "../../contexts/services";
import { useMilestoneChannel } from "../../contexts/milestone";
import { compositionFromRun, type RunStep, type Take } from "../../../core/takes";
import { isPreciseInput } from "../../../core/midi";
import { paintPlayedNotes } from "../../lib/scoreColor";
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
    // The run recorder (core/runCapture): the cleared notes' timing, the open key-holds,
    // the run clock's zero, and the imprecise-input flag. One ref, because the matcher
    // callback and the MIDI release handler both advance it between renders.
    const captureRef = useRef<RunCapture>(startCapture());
    const synth = useSynth();
    // Tempo-enforced "keep up" mode: Practice runs at a fixed tempo, the cursor advancing
    // on the clock rather than waiting for you, so a note not cleared before it passes is a
    // miss. `guideNotes` sounds the notes as they pass for a follow-along; off, it's a
    // read-at-tempo test. Session toggles (not persisted), off by default.
    const [enforceTempo, setEnforceTempo] = useState(false);
    const [guideNotes, setGuideNotes] = useState(true);
    // This score's saved takes. How the finished run's save went lives with the rest of
    // the run result below.
    const [takes, setTakes] = useState<Take[]>([]);
    // The tempo settings — the slider, the adaptive live pace, the metronome toggles and
    // the tempo trainer — held together. The metronome *effect* stays at its call site
    // below: it reads keepUp.running, which is created after this.
    const {
        tempo,
        setTempo,
        liveTempo,
        readTempo,
        resyncLive,
        easeToward,
        metronomeOn,
        setMetronomeOn,
        subdivision,
        setSubdivision,
        adaptive,
        setAdaptive,
        trainerOn,
        setTrainerOn,
        trainerTarget,
        setTrainerTarget,
        bumpTempo,
    } = useTempoControls({ initialTempo: initialTempo ?? 100 });
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
    // (not a reload) so it can go on and off mid-play without tearing down a run.
    const [showFingerings, setShowFingerings] = useState(() => prefsStore.load().showFingerings);
    // Whether the staff scrolls to keep the played note in view. On by default; the
    // treadmill drives its own centring, so OSMD's follow is off there. Applied straight to
    // OSMD (no reload).
    const [scrollFollow, setScrollFollow] = useState(true);
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
    // Which hand to practice — the hands-separate selector only appears for the
    // grand-staff (two-staff) scores it applies to (the staff count comes from the score).
    const [hand, setHand] = useState<Hand>("both");

    // The finished self-paced run's result — the grade and every surface derived from
    // it (per-note strip, share grid, tempo curve) plus the save verdict — owned as one
    // unit that records, marks and clears together. Seeded when a saved daily re-opens.
    const runResult = useRunResult(seededResult);
    const {
        grade,
        notes: runNotes,
        tolerance: runTolerance,
        grid: shareGrid,
        tempoCurve,
        saved: runSaved,
    } = runResult;
    // An earned moment (first S, grade-up, flawless run) is published to the app-wide
    // channel once the run's mastery is folded in, for the shell banner to celebrate. At
    // most one per run; cleared at the next run's start.
    const { publish: publishMilestone, dismiss: dismissMilestone } = useMilestoneChannel();
    // The tempo a run was matched at, captured when practice starts so the run's
    // self-paced tempo curve reads against the same reference the matcher used,
    // even if the slider is moved afterwards.
    const runTempoRef = useRef(initialTempo ?? 100);
    // A run that began partway through — taking over from Listen, or resuming where a
    // stopped run left off. It is graded for what was played, but keeps no ghost: a
    // partial replay would strand the next race at its early end, and chasing a
    // full-piece ghost from the middle is meaningless.
    const partialRunRef = useRef(false);

    // The cursor's current position in whole notes — the shared place Listen and
    // Practice hand off at, so switching between them (or leaving and re-entering the
    // play surface) continues here rather than rewinding.
    // Load this score's saved takes; a new score swaps in its own.
    useEffect(() => {
        setTakes(services.takes.list(id));
    }, [id, services.takes.list]);

    // The score-rendering surface: OSMD loads and re-renders the piece, and reports what
    // the rest of the play surface reads off it. The transports and the matcher drive the
    // cursor through getOsmd(); it is created before them so they can read it. Its own
    // coordination callbacks run through refs inside the hook, so referencing those
    // later-created transports from here is safe — they are called only after render.
    const score = useOsmdScore(containerRef, {
        xml,
        transpose,
        showMine,
        saved,
        barsPerRow,
        barNumbers,
        treadmill,
        showFingerings,
        scrollFollow,
        onReload: () => {
            listenPlayback.stop();
            keepUp.stop();
            matcher.stop();
        },
        onRendered: ({ bars, freshPiece }) => {
            // A fresh render carries no in-progress click selection.
            loop.cancelSelection();
            // The hand selection and the bar range belong to the piece, not the layout: a
            // relayout keeps the same staves and bars, so a chosen hand and loop survive it,
            // reseeding only when the piece itself changes. A fresh piece seeds the hand to
            // both and the loop to the whole song.
            if (freshPiece) {
                setHand("both");
                loop.reseedWholeSong(bars);
            }
        },
    });
    const {
        getOsmd,
        ready,
        loadError,
        staffCount,
        measureCount,
        measureBoxes,
        centerCursor,
        markPainted,
        painted,
        resetPaint,
        renderVersion,
    } = score;

    // The cursor's current position in whole notes — the shared place Listen and Practice
    // hand off at, so switching between them (or leaving and re-entering the play surface)
    // continues here rather than rewinding.
    const resumePoint = () => cursorWhole(getOsmd()?.cursor);

    // Tempo-locked play-along ("keep up"): the clock advances the cursor and scores each
    // beat; finishing drops out of full screen so the result comes into view.
    const keepUp = useKeepUp({
        getOsmd,
        synth,
        tempo: readTempo,
        beatsPerBar: beatsPerBar ?? 4,
        centerCursor,
        markPainted,
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
            const osmd = getOsmd();
            if (osmd) {
                paintPlayedNotes(osmd, info.pitches);
                markPainted();
            }
            // Record the cleared note — its ideal and actual timing, and a hold per
            // pitch for the release to close — for the grade, the per-note strip, the
            // share grid and the saved take.
            captureCleared(captureRef.current, info);
            // Ease the adaptive metronome toward the player's own pace, read from the
            // gap between the last two notes.
            easeToward(captureRef.current, runTempoRef.current);
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
    // Section looping: the loop range, the click-to-select, and the red overlay that OSMD's
    // fresh SVG drops on each render (repainted off renderVersion). A click builds the range
    // only when the score is idle — not mid-run or mid-playback (canSelect), read at click
    // time so it can see the transports created below.
    const loop = useLoopSelection({
        containerRef,
        measureBoxes,
        measureCount,
        renderVersion,
        canSelect: () => !matcher.practicing && !listenPlayback.active() && measureCount > 1,
    });

    const isPracticing = useCallback(() => matcher.practicing, [matcher.practicing]);
    const listenPlayback = useListenPlayback({
        getOsmd,
        synth,
        tempo: readTempo,
        loop: loop.read,
        onLap: bumpTempo,
        centerCursor,
        markPainted,
        isPracticing,
    });

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
        const outcome = deriveRunOutcome({
            notes,
            correct: matcher.total,
            wrong: matcher.wrong,
            imprecise: captureRef.current.imprecise,
            intendedTempo: initialTempo ?? runTempoRef.current,
            runTempo: runTempoRef.current,
        });
        gradeFromRunRef.current = true;
        runResult.record({ ...outcome, notes });
        // A short major flourish to celebrate finishing — a fuller arpeggio for a
        // stronger grade, a gentle lift for a weaker one, never a penalty. playNote
        // no-ops when sound is muted, so the mute checkbox is the gate.
        for (const beat of cadence(outcome.grade.letter)) {
            synth.playNote(beat.note, {
                velocity: beat.velocity,
                duration: beat.duration,
                delay: beat.at,
            });
        }
        // A finished run nudges the tempo trainer up for the next attempt.
        bumpTempo();
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
                grade: outcome.grade,
                grid: outcome.grid,
                tolerance: outcome.tolerance,
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
        runResult.record,
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

    // Wipe the self-paced run's result and the earned milestone. A fresh self-paced run
    // and a keep-up run both clear them, so a finished self-paced result can't linger
    // beneath the next run, and its Save prompt can't save a stale take (a keep-up run
    // never rewrites the capture the prompt would save).
    const clearSelfPacedResult = () => {
        runResult.clear();
        dismissMilestone();
    };

    // Start a tempo-locked play-along: the play surface goes full screen, any
    // self-paced run stops, last run's result and colours wipe, and the keep-up clock
    // takes over — scoring only the practised hand, exactly as self-paced practice does.
    const playAlong = () => {
        const osmd = getOsmd();
        if (!osmd || listenPlayback.active() || keepUp.active()) {
            return;
        }
        enterPlayFullscreen();
        matcher.stop();
        clearSelfPacedResult();
        if (painted()) {
            osmd.render();
            resetPaint();
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
        runResult.markSaved(saved.stored);
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
        clearSelfPacedResult();
        // A fresh recorder also zeroes the run clock, so the ghost tick's startedAt
        // guard holds until the run's first note arrives — a stale start timestamp
        // would paint the ghost at the finish the moment Practice is pressed.
        captureRef.current = startCapture();
        gradeFromRunRef.current = false;
        gradedRef.current = false;
        keepUp.clearResult();
        resyncLive();
        runTempoRef.current = tempo;
        // The hand the matcher and the ghost step through: the whole grand staff
        // when there's a single staff, otherwise the hand being drilled. (Fingering
        // is printed on the staff at load time, not computed per run.)
        const matcherHand: Hand = staffCount < 2 ? "both" : hand;
        // A fresh run from the top wipes the previous run's colours for a clean slate; a
        // resumed run (taking over from Listen) keeps them, so the blue Listen trail and
        // any earlier green survive and the score shows how the whole piece was played.
        if (!partial && painted()) {
            getOsmd()?.render();
            resetPaint();
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
                                    const osmd = getOsmd();
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
                {ready && measureCount > 1 && loop.on && !matcher.practicing && !keepUp.running && (
                    <LoopRangeBar
                        measureCount={measureCount}
                        from={loop.from}
                        to={loop.to}
                        setFrom={loop.setFrom}
                        setTo={loop.setTo}
                        onWholeSong={loop.wholeSong}
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
                        onClick={(event) => loop.selectBarAt(event.clientX, event.clientY)}
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
                    loopOn={loop.on}
                    onToggleLoop={loop.toggle}
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
