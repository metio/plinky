// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import {
    createContext,
    type ReactNode,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import { cadence } from "../../../core/cadence";
import type { DailyResult } from "../../../core/daily";
import { nextKeyboardWindow, type Span } from "../../../core/keyboardWindow";
import { isPreciseInput } from "../../../core/midi";
import {
    captureCleared,
    captureRelease,
    type RunCapture,
    startCapture,
} from "../../../core/runCapture";
import { deriveRunOutcome } from "../../../core/runOutcome";
import { compositionFromRun, type RunStep, type Take } from "../../../core/takes";
import { transposeMusicXml } from "../../../core/transpose";
import { useMilestoneChannel } from "../../contexts/milestone";
import { useMidiConnection, useMidiInput } from "../../contexts/midi";
import { useServices, useXmlCodec } from "../../contexts/services";
import { useFullscreen } from "../../hooks/useFullscreen";
import { useGhostRace } from "../../hooks/useGhostRace";
import { useKeepUp } from "../../hooks/useKeepUp";
import { useListenPlayback } from "../../hooks/useListenPlayback";
import { useLoopSelection } from "../../hooks/useLoopSelection";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import { useMetronome } from "../../hooks/useMetronome";
import { useOsmdScore } from "../../hooks/useOsmdScore";
import { usePref } from "../../hooks/usePref";
import { useReadingMode } from "../../hooks/useReadingMode";
import { useRunResult } from "../../hooks/useRunResult";
import { type CorrectInfo, type Hand, useScoreMatcher } from "../../hooks/useScoreMatcher";
import { useSynth } from "../../hooks/useSynth";
import { useTempoControls } from "../../hooks/useTempoControls";
import { cursorWhole } from "../../lib/scoreCursor";
import { paintPlayedNotes } from "../../lib/scoreColor";
import { recordRun } from "../../lib/recordRun";
import { FullscreenProvider, useMidiConnected } from "./conditional";
import { useTranspose } from "./transposeContext";

// Everything a piece needs to be played: the OSMD render surface, the transports (Listen,
// self-paced Practice, tempo-locked keep-up), the ghost race, the loop, the tempo and
// reading settings, the finished-run result, and the actions that drive them. ScoreViewer
// only produces the run; the play surface reacts to this shared session.
export type PlaySessionProps = {
    id: string;
    xml: string;
    title: string;
    onRunComplete?: () => void;
    initialTempo?: number;
    beatsPerBar?: number;
    lockTempo?: boolean;
    daily?: number;
    ephemeral?: boolean;
    canShareGhost?: boolean;
    seededResult?: DailyResult | null;
};

// Assembles the whole play session: all the hooks, the effects that coordinate them, and
// the actions the surface calls. Held apart from the JSX so the surface reads it through
// context — the transport bar, the score canvas and the practice stage become siblings
// that react to one source of truth rather than one component owning it all.
function usePlaySessionValue({
    id,
    xml,
    title,
    onRunComplete,
    initialTempo,
    beatsPerBar,
    lockTempo,
    daily,
    ephemeral,
    canShareGhost,
    seededResult,
}: PlaySessionProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const rootRef = useRef<HTMLDivElement>(null);
    const gradePanelRef = useRef<HTMLDivElement>(null);
    // True only once a run finishes this session, so the result scroll fires on
    // completion but not when the grade is seeded from a saved result on mount.
    const gradeFromRunRef = useRef(false);
    // Latches a completed run's grading so its side effects (history, lifetime,
    // ghost, mastery, daily, cadence) land exactly once. The completion effect
    // depends on inputs — like an onRunComplete callback the parent re-creates each
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
    // This score's saved takes. How the finished run's save went lives with the run result.
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
    const services = useServices();
    // The fingering the player worked out for this piece (Fingering mode). When they
    // have some, the staff can show theirs instead of the app's suggestion — defaulting
    // to theirs, since they chose it on purpose.
    const saved = useMemo(() => services.fingering.load(id), [id, services.fingering]);
    const hasSaved = Object.keys(saved).length > 0;
    const [showMine, setShowMine] = useState(hasSaved);
    const { prefs: prefsStore } = services;
    const xmlCodec = useXmlCodec();
    // How the score is laid out and read — bars per row, bar numbers, treadmill, on-staff
    // fingering and follow-the-note scrolling — the toggles that feed the OSMD render.
    const reading = useReadingMode();
    const { barsPerRow, barNumbers, treadmill, showFingerings, scrollFollow } = reading;
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
    // Whether the Practice-tools drawer (all the play settings) is open.
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
    const [raceGhost, setRaceGhost] = usePref(prefsStore, "raceGhost");
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
    const { getOsmd, ready, staffCount, measureCount, measureBoxes, centerCursor, markPainted } =
        score;

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

    // A metronome on demand: fixed at the chosen tempo, or following the player's own pace
    // when adaptive. Keep-up mode always ticks (a count-in then the beat you're racing),
    // whatever the metronome toggle; a self-paced run honours the toggle.
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

    // Section looping: the loop range, the click-to-select, and the red overlay that OSMD's
    // fresh SVG drops on each render (repainted off renderVersion). A click builds the range
    // only when the score is idle — not mid-run or mid-playback (canSelect), read at click
    // time so it can see the transports created below.
    const loop = useLoopSelection({
        containerRef,
        measureBoxes,
        measureCount,
        renderVersion: score.renderVersion,
        canSelect: () => !matcher.practicing && !listenPlayback.active() && measureCount > 1,
    });

    // The listening transport — Listen and take-replay share one cursor walk, one clock,
    // one stop. It reads the loop range and tempo live, marks the score as painted when its
    // trail lands, and leaves the cursor shown if the matcher owns it.
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
        if (!runResult.grade || !gradeFromRunRef.current) {
            return;
        }
        const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        const frame = requestAnimationFrame(() => {
            gradePanelRef.current?.scrollIntoView({
                behavior: smooth ? "smooth" : "auto",
                block: "center",
            });
        });
        return () => cancelAnimationFrame(frame);
    }, [runResult.grade]);

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
            onRunComplete?.();
        }
    }, [
        matcher.complete,
        matcher.total,
        matcher.wrong,
        id,
        title,
        onRunComplete,
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

    // Playing goes full screen on every device. The play surface holds controls that live
    // only there — Listen, the finger-number and follow-the-note toggles, the on-staff
    // exit — so the run needs the room whatever the screen size. On a phone it also
    // reclaims the browser chrome (the URL bar) that the keyboard would otherwise crowd out.
    const enterPlayFullscreen = () => {
        if (!fullscreen) {
            enterFullscreen();
        }
    };

    // Start Listen: the play surface goes full screen, any self-paced run stops, and the
    // transport walks the cursor from wherever it sits — the note Practice was on when
    // handing over, or where a paused run left off — instead of rewinding, so play can pass
    // back and forth without losing the place.
    const listen = () => {
        if (listenPlayback.active() || keepUp.active()) {
            return;
        }
        const from = resumePoint();
        enterPlayFullscreen();
        matcher.stop();
        listenPlayback.start(from);
    };

    // Restart Listen from the top (or the loop's start bar). The trail wipes like a
    // fresh practice run, so the blue tells the story of this pass only.
    const restartListen = () => {
        if (!listenPlayback.playing) {
            return;
        }
        listenPlayback.stop();
        if (score.painted()) {
            getOsmd()?.render();
            score.resetPaint();
        }
        listenPlayback.start(0);
    };

    // Wipe the self-paced run's result and the earned milestone. A fresh self-paced run
    // and a keep-up run both clear them, so a finished self-paced result can't linger
    // beneath the next run, and its Save prompt can't save a stale take (a keep-up run
    // never rewrites the capture the prompt would save).
    const clearSelfPacedResult = () => {
        runResult.clear();
        dismissMilestone();
    };

    // Start a tempo-locked play-along: the play surface goes full screen, any self-paced
    // run stops, last run's result and colours wipe, and the keep-up clock takes over —
    // scoring only the practised hand, exactly as self-paced practice does.
    const playAlong = () => {
        const osmd = getOsmd();
        if (!osmd || listenPlayback.active() || keepUp.active()) {
            return;
        }
        enterPlayFullscreen();
        matcher.stop();
        clearSelfPacedResult();
        if (score.painted()) {
            osmd.render();
            score.resetPaint();
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
            letter: runResult.grade?.letter ?? "",
            complete: matcher.complete,
            metrics: runResult.grade ?? null,
            composition: compositionFromRun(steps, tempo, beatsPerBar ?? 4),
        };
        const stored = services.takes.save(id, take);
        setTakes(stored.takes);
        runResult.markSaved(stored.stored);
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
        if (!partial && score.painted()) {
            getOsmd()?.render();
            score.resetPaint();
        }
        // Arm the ghost race post-render, so its marker moves along the freshly drawn notes.
        ghostRace.arm({ partial, ephemeral, raceGhost, hand: matcherHand });
        matcher.start(from);
    };

    // Reveal the next note by colour per the player's hint setting — always, only once
    // they've slipped at this position, or never. A wrong key flashes red regardless.
    const noteHints = prefsStore.load().noteHints;
    const hintNotes =
        noteHints === "always" || (noteHints === "miss" && matcher.missedHere)
            ? matcher.expected
            : [];

    // The run's tempo re-referenced to the piece's own, so the results panel reads the
    // lagging hand at the same scale the share grid was built with.
    const intendedTempo = initialTempo ?? runTempoRef.current;
    const runTempoScale = intendedTempo > 0 ? runTempoRef.current / intendedTempo : 1;

    // Dismiss the rotate-your-phone nudge, and remember the choice.
    const dismissRotate = () => {
        services.store.set("plinky:rotate-hint", "dismissed");
        setRotateDismissed(true);
    };

    return {
        // Piece identity and framing.
        id,
        title,
        daily,
        ephemeral,
        lockTempo,
        // The layout shell + full-screen state.
        containerRef,
        rootRef,
        gradePanelRef,
        fullscreen,
        compact,
        exitFullscreen,
        hideKeyboard,
        setHideKeyboard,
        toolsOpen,
        setToolsOpen,
        runsOpen,
        setRunsOpen,
        portrait,
        coarsePointer,
        rotateDismissed,
        dismissRotate,
        // The render surface.
        score,
        getOsmd,
        ready,
        loadError: score.loadError,
        staffCount,
        measureCount,
        // Reading + keyboard framing.
        reading,
        keyWindow,
        setKeyWindow,
        keyboardOctaves,
        setKeyboardOctaves,
        hintNotes,
        focusXml,
        // Tempo settings.
        tempo,
        setTempo,
        liveTempo,
        trainerOn,
        setTrainerOn,
        trainerTarget,
        setTrainerTarget,
        metronomeOn,
        setMetronomeOn,
        adaptive,
        setAdaptive,
        subdivision,
        setSubdivision,
        // Play options.
        enforceTempo,
        setEnforceTempo,
        guideNotes,
        setGuideNotes,
        forgiving,
        setForgiving,
        raceGhost,
        setRaceGhost,
        transpose,
        setTranspose,
        showMine,
        setShowMine,
        hasSaved,
        hand,
        setHand,
        // Transports and the run.
        matcher,
        keepUp,
        listenPlayback,
        ghostRace,
        loop,
        runResult,
        runTempoScale,
        // MIDI connection.
        connected,
        status,
        requestAccess,
        // Saved takes.
        takes,
        // Actions the surface drives.
        listen,
        restartListen,
        practice,
        playAlong,
        saveCurrentTake,
        replayTake,
        deleteTake,
    };
}

export type PlaySession = ReturnType<typeof usePlaySessionValue>;

const PlaySessionContext = createContext<PlaySession | null>(null);

// Read the play session. Throws outside a provider so a wrongly mounted surface fails loud
// rather than silently rendering an empty score.
export function usePlaySession(): PlaySession {
    const session = useContext(PlaySessionContext);
    if (!session) {
        throw new Error("usePlaySession must be used within a PlaySessionProvider");
    }
    return session;
}

// Runs the whole play session and renders the full-screen shell around the surface. The
// shell owns rootRef (the full-screen target) and the full-screen background, so the
// surface inside reads everything else through context.
export function PlaySessionProvider({
    children,
    ...props
}: PlaySessionProps & { children: ReactNode }) {
    const session = usePlaySessionValue(props);
    return (
        <PlaySessionContext.Provider value={session}>
            <FullscreenProvider active={session.fullscreen}>
                <div
                    ref={session.rootRef}
                    className={
                        session.fullscreen
                            ? "fixed inset-0 z-50 flex flex-col gap-2 bg-white p-3 dark:bg-gray-950"
                            : "space-y-3"
                    }
                >
                    {children}
                </div>
            </FullscreenProvider>
        </PlaySessionContext.Provider>
    );
}
