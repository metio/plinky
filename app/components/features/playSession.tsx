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
    useSyncExternalStore,
} from "react";
import { beamsVisible } from "../../../core/beams";
import { cadence } from "../../../core/cadence";
import { gradeOf } from "../../../core/scoreDifficulty";
import { DEFAULT_KEY_RANGE, songKeyRange } from "../../../core/keyboardRange";
import type { Grade } from "../../../core/grade";
import type { DailyResult } from "../../../core/daily";
import { holdScaleFor, isPreciseInput, MIC_DEVICE } from "../../../core/midi";
import {
    captureCleared,
    capturePedal,
    captureRelease,
    flushHolds,
    type RunCapture,
    startCapture,
} from "../../../core/runCapture";
import { deriveRunOutcome } from "../../../core/runOutcome";
import { compositionFromRun, type RunStep, type Take } from "../../../core/takes";
import { useTakes } from "../../hooks/useTakes";
import { transposeMusicXml } from "../../../core/transpose";
import { useMilestoneChannel } from "../../contexts/milestone";
import { useMidiConnection, useMidiInput } from "../../contexts/midi";
import {
    useAnalytics,
    useHintsStore,
    useOnboardingStore,
    useScheduler,
    useServices,
    useXmlCodec,
} from "../../contexts/services";
import { useFullscreen } from "../../hooks/useFullscreen";
import { useDuet } from "../../hooks/useDuet";
import { useGhostRace } from "../../hooks/useGhostRace";
import { useHoldIndicator } from "../../hooks/useHoldIndicator";
import { useKeepUp } from "../../hooks/useKeepUp";
import { useListenPlayback } from "../../hooks/useListenPlayback";
import { useLoopSelection } from "../../hooks/useLoopSelection";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import { useMetronome } from "../../hooks/useMetronome";
import { useOsmdScore } from "../../hooks/useOsmdScore";
import { usePref } from "../../hooks/usePref";
import { useReadingMode } from "../../hooks/useReadingMode";
import { useRunResult } from "../../hooks/useRunResult";
import {
    collectSteps,
    type CorrectInfo,
    type Hand,
    useScoreMatcher,
} from "../../hooks/useScoreMatcher";
import { useHiddenNotes } from "../../hooks/useHiddenNotes";
import { useSynth } from "../../hooks/useSynth";
import { useTempoControls } from "../../hooks/useTempoControls";
import { cursorWhole, seekToBar } from "../../lib/scoreCursor";
import { paintPlayedNotes } from "../../lib/scoreColor";
import { recordRun } from "../../lib/recordRun";
import { FullscreenProvider, useMidiConnected } from "./conditional";
import { useTranspose } from "./transposeContext";

// The one-time hint nudging a touch phone sideways for a wider keyboard.
const ROTATE_HINT_ID = "rotate";

// Everything a piece needs to be played: the OSMD render surface, the transports (Listen,
// self-paced Practice, tempo-locked keep-up), the ghost race, the loop, the tempo and
// reading settings, the finished-run result, and the actions that drive them. ScoreViewer
// only produces the run; the play surface reacts to this shared session.
export type PlaySessionProps = {
    id: string;
    xml: string;
    title: string;
    // The provenance line burnt into an exported take video; empty means the
    // piece carries no credit beyond its title (a generated exercise).
    credit?: string;
    onRunComplete?: () => void;
    initialTempo?: number;
    beatsPerBar?: number;
    lockTempo?: boolean;
    daily?: number;
    ephemeral?: boolean;
    canShareGhost?: boolean;
    seededResult?: DailyResult | null;
    // The resting page's Runs tab: true renders the saved-runs page instead of the
    // resting play column (fullscreen is unaffected), and the callback hops back to
    // the score — the session can't own the tab, the route does.
    runsView?: boolean;
    onShowScore?: () => void;
};

// Assembles the whole play session: all the hooks, the effects that coordinate them, and
// the actions the surface calls. Held apart from the JSX so the surface reads it through
// context — the transport bar, the score canvas and the practice stage become siblings
// that react to one source of truth rather than one component owning it all.
function usePlaySessionValue({
    id,
    xml,
    title,
    credit,
    onRunComplete,
    initialTempo,
    beatsPerBar,
    lockTempo,
    daily,
    ephemeral,
    canShareGhost,
    seededResult,
    runsView = false,
    onShowScore,
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
    // Latches the auto-save of the finished run's take, separate from grading: the take is
    // saved only once the final note is released, so its recorded length is the real hold
    // rather than the beat the run completed on. Reset at run start.
    const takeSavedRef = useRef(false);
    // The finished run's grade, stashed for the deferred take-save: grading records into
    // runResult a render later, so the save (which can run in the same commit) reads it here
    // instead of the not-yet-updated runResult.grade.
    const finishedGradeRef = useRef<Grade | null>(null);
    // The run recorder (core/runCapture): the cleared notes' timing, the open key-holds,
    // the run clock's zero, and the imprecise-input flag. One ref, because the matcher
    // callback and the MIDI release handler both advance it between renders.
    const captureRef = useRef<RunCapture>(startCapture());
    const synth = useSynth();
    const scheduler = useScheduler();
    const analytics = useAnalytics();
    // The shrinking hold-duration fill on the on-screen keys — armed per correct
    // note below, cleared whenever a run stops.
    const holdIndicator = useHoldIndicator();
    // Tempo-enforced "keep up" mode: Practice runs at a fixed tempo, the cursor advancing
    // on the clock rather than waiting for you, so a note not cleared before it passes is a
    // miss. `guideNotes` sounds the notes as they pass for a follow-along; off, it's a
    // read-at-tempo test. Session toggles (not persisted), off by default.
    const [enforceTempo, setEnforceTempo] = useState(false);
    const [guideNotes, setGuideNotes] = useState(true);
    // Duet: sound the other hand while you play yours during a hands-separate keep-up run.
    // Off by default and, like the others, a session toggle rather than a saved pref.
    const [duet, setDuet] = useState(false);
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
    // This score's saved takes, live over the store; how the finished run's save
    // went lives with the run result.
    const takesList = useTakes(services.takes, id);
    // The fingering the player worked out for this piece (Fingering mode). When they
    // have some, the staff can show theirs instead of the app's suggestion — defaulting
    // to theirs, since they chose it on purpose.
    // Re-read on every fingering write (the strip saves through the same store), so
    // fingering worked out this session reaches the score without a remount.
    const [fingeringTick, setFingeringTick] = useState(0);
    useEffect(
        () => services.fingering.subscribe(() => setFingeringTick((tick) => tick + 1)),
        [services.fingering],
    );
    // biome-ignore lint/correctness/useExhaustiveDependencies: fingeringTick is the re-read trigger when the strip saves through the same store
    const saved = useMemo(
        () => services.fingering.load(id),
        [id, services.fingering, fingeringTick],
    );
    const hasSaved = Object.keys(saved).length > 0;
    const [showMine, setShowMine] = useState(hasSaved);
    // Once a fingering exists, default to showing theirs — the moment it's first worked
    // out this session, not only on a fresh mount.
    useEffect(() => {
        if (hasSaved) {
            setShowMine(true);
        }
    }, [hasSaved]);
    const { prefs: prefsStore } = services;
    const xmlCodec = useXmlCodec();
    // How the score is laid out and read — bars per row, bar numbers, treadmill, on-staff
    // fingering and follow-the-note scrolling — the toggles that feed the OSMD render.
    const reading = useReadingMode();
    const { barsPerRow, barNumbers, treadmill, showFingerings, scrollFollow } = reading;
    // The piece's 1–8 difficulty grade, so "auto" beam mode can hide beam groups on the
    // easy grades a beginner reads note-by-note. gradeOf is memoised by the content id, so
    // this is a map lookup after the first render.
    const grade = useMemo(() => gradeOf(xmlCodec, id, xml), [xmlCodec, id, xml]);
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
    // The fullscreen fingering editor: swaps the on-screen keyboard for the
    // fingering strip and washes the score with the difficulty heat-map.
    const [fingerStrip, setFingerStripState] = useState(false);
    // Opening the fingering editor ticks its discovery step — the strip is the
    // fingering drill's home now that its tab is gone.
    const setFingerStrip: typeof setFingerStripState = (value) => {
        if (value === true || (typeof value === "function" && value(fingerStrip))) {
            onboarding.markDiscovered("fingeringTried");
        }
        setFingerStripState(value);
    };
    // Whether the Runs drawer (your saved performances of this piece) is open.

    const [raceGhost, setRaceGhost] = usePref(prefsStore, "raceGhost");
    // A once-dismissible nudge to turn a touch phone sideways for a wider keyboard, only
    // when it would actually help (portrait, no MIDI). The server snapshot treats it as
    // dismissed so the prerendered HTML never flashes it; the portrait layout stays
    // fully usable, so this never forces an orientation (WCAG 1.3.4).
    const hints = useHintsStore();
    const rotateDismissed = useSyncExternalStore(
        hints.subscribe,
        () => hints.seen(ROTATE_HINT_ID),
        () => true,
    );
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
        noteScale: reading.noteScale,
        barNumbers,
        treadmill,
        showBeams: beamsVisible(reading.beams, grade),
        colorNotes: reading.colorNotes,
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
        // The in-place fingering redraw rebuilt the noteheads mid-run: re-apply the ear-mode
        // conceal so a hidden run's blanked answers aren't exposed by the fresh render.
        onFingeringRedraw: () => hidden.reconceal(),
    });
    const { getOsmd, ready, staffCount, measureCount, measureBoxes, centerCursor, markPainted } =
        score;

    // Frame the on-screen keyboard around the notes THIS piece uses, so a narrow
    // tune shows a short keyboard instead of a fixed two octaves. Recomputed only
    // when the sounding pitches can have changed — a new piece (xml) or a
    // transposition — never on a layout relayout or a mid-run repaint, so reading
    // the steps (which walks and resets the cursor) can't disturb a live run.
    const [keyRange, setKeyRange] = useState<{ from: number; to: number }>(DEFAULT_KEY_RANGE);
    // xml/transpose/staffCount aren't read in the body — they are the triggers:
    // the sounding pitches change only when the piece or its key does, and gating
    // on them keeps collectSteps (which walks the cursor) off the mid-run repaint
    // path. The osmd is read imperatively through the stable getOsmd.
    // biome-ignore lint/correctness/useExhaustiveDependencies: xml/transpose/staffCount are content-change triggers
    useEffect(() => {
        const osmd = getOsmd();
        if (!ready || !osmd) {
            return;
        }
        // Both hands, so switching the practised hand never resizes the keyboard.
        setKeyRange(songKeyRange(collectSteps(osmd, "both").flat()));
    }, [ready, xml, transpose, staffCount, getOsmd]);

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
    const [metronomeAccent] = usePref(prefsStore, "metronomeAccent");
    useMetronome(
        metronomeOn || keepUp.running,
        keepUp.running ? tempo : adaptive ? liveTempo : tempo,
        beatsPerBar ?? 4,
        keepUp.running ? 1 : subdivision,
        metronomeAccent,
    );

    // Keep-going mode, remembered across pieces; captured by the matcher at run start.
    const [forgiving, setForgiving] = usePref(prefsStore, "forgiving");
    // Hidden-notes (ear) practice: noteheads start blank and reveal green as they are
    // found, red once the tries budget is spent. Persisted like the other play prefs.
    const onboarding = useOnboardingStore();
    const [hiddenNotes, setHiddenNotesPref] = usePref(prefsStore, "hiddenNotes");
    // Turning the ear drill on ticks its discovery step — the toggle IS the
    // feature now that the Ear tab is gone.
    const setHiddenNotes = (value: boolean) => {
        if (value) {
            onboarding.markDiscovered("earTried");
        }
        setHiddenNotesPref(value);
    };
    const [revealTries, setRevealTries] = usePref(prefsStore, "revealTries");
    const hidden = useHiddenNotes(getOsmd, {
        enabled: hiddenNotes,
        tries: revealTries,
        hand: staffCount < 2 ? "both" : hand,
    });
    // Turning the mode off mid-piece must bring the music back immediately.
    useEffect(() => {
        if (!hiddenNotes) {
            hidden.restore();
        }
    }, [hiddenNotes, hidden.restore]);
    // The microphone as an input: while it listens, the player already hears
    // their real piano, so echoing the note back through the synth only doubles
    // the sound and feeds the app's own output into the mic. (The session already
    // subscribes to this context via useMidiConnected, so reading it is free.)
    const { micStatus, pedalHeld } = useMidiConnection();
    const micListening = micStatus === "listening";

    // The hand the run drills — forced to "both" for a single-staff piece, where the
    // hand selector never shows.
    const activeHand: Hand = staffCount < 2 ? "both" : hand;
    // The self-paced duet: sound the sitting-out hand as you play. Off in keep-up,
    // where the tempo-locked run plays the other hand on its own clock instead.
    const accompaniment = useDuet({
        getOsmd,
        playNote: synth.playNote,
        scheduler,
        enabled: duet && !enforceTempo && staffCount >= 2 && activeHand !== "both",
        hand: activeHand,
    });

    const matcher = useScoreMatcher(getOsmd, {
        tempo,
        hand,
        forgiving,
        onCorrect: (info: CorrectInfo) => {
            // Skip the note-echo under mic input — you hear your own piano.
            if (!micListening) {
                // Press a live voice per cleared pitch — it rings until the key lifts (or
                // the pedal does), so the guide tone follows the player's own articulation:
                // a quick release sounds staccato, a long hold sustains, and it strikes as
                // hard as the note was played.
                //
                // Only for a pitch whose key is STILL down. A position clears when its last
                // pitch is played, but the matcher never sees note-offs, so a chord rolled
                // (or the forgiving skip crediting an earlier hit) can clear while an earlier
                // pitch's key is already up. Pressing a voice for that pitch would open one
                // with no key-up left to release it — it would ring on forever.
                for (const pitch of info.pitches) {
                    if (heldNotes.current.has(pitch)) {
                        synth.pressNote(pitch, { velocity: info.velocity });
                    }
                }
            }
            // A hidden note earned its reveal — lift the blank before the green
            // paint below, so the note appears already coloured.
            hidden.revealCorrect(info.index);
            // Colour the notes just cleared — the cursor is still on them, as it
            // only advances after this callback — so the score shows progress.
            const osmd = getOsmd();
            if (osmd) {
                paintPlayedNotes(osmd, info.pitches);
                markPainted();
            }
            // Show how long to keep holding, but only in the full-guidance hint mode
            // — the same beginner crutch the pre-highlight belongs to. A sight-reader
            // who dialled hints down gets no afterglow.
            if (noteHints === "always") {
                holdIndicator.begin(info.pitches, info.holdMs);
            }
            // Record the cleared note — its ideal and actual timing, and a hold per
            // pitch for the release to close — for the grade, the per-note strip, the
            // share grid and the saved take.
            captureCleared(captureRef.current, info);
            // Ease the adaptive metronome toward the player's own pace, read from the
            // gap between the last two notes.
            easeToward(captureRef.current, runTempoRef.current);
            // Sound the sitting-out hand across the gap up to your next note, laid
            // out at the pace you're playing at right now (a no-op unless the duet is
            // on). Uses the live tempo captured for this render, so it tracks the same
            // adaptive pace the metronome eases toward.
            accompaniment.onCleared(info.index, liveTempo);
        },
        onWrong: ({ index, misses }) => {
            // The tries budget spent on a hidden note reveals it red — the lesson
            // arrives, and (keep-going aside) the run still waits for the right key.
            hidden.revealMissed(index, misses);
            markPainted();
        },
    });
    // Keys the player is holding down right now. A finished run defers leaving full
    // screen while any of these ring, so the last note plays out for as long as it is
    // held instead of being cut off the instant the run completes.
    const heldNotes = useRef(new Set<number>());
    const [holdingNote, setHoldingNote] = useState(false);
    const syncHolding = useCallback(() => setHoldingNote(heldNotes.current.size > 0), []);
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
            // The mic's note-off is the detector's own timing, never a real key lift, so a
            // mic note would stick in the held set and hold full screen open forever. Only
            // keyed input, which releases cleanly, defers the exit.
            if (event.device !== MIC_DEVICE) {
                heldNotes.current.add(event.note);
                syncHolding();
            }
            matcher.registerNote(event.note, event.timestamp, event.velocity);
        },
        // A released key ends its live voice and fills in the run note's real hold length,
        // so the sound and the recording both follow how long you actually held — a quick
        // tap plays and records staccato, a long hold sustains. The microphone is left out:
        // its note-off is the pitch detector's own timing, too noisy to read as
        // articulation, and it opened no voice to end.
        onNoteOff: (event) => {
            if (event.device === MIC_DEVICE) {
                return;
            }
            // On-screen taps and computer keys ring on a little so a short jab still sounds
            // musical; a real MIDI key keeps its own articulation (holdScale 1).
            synth.releaseNote(event.note, holdScaleFor(event.device));
            heldNotes.current.delete(event.note);
            syncHolding();
            captureRelease(captureRef.current, event.note, event.timestamp);
        },
        // The pedals shape the live sound; the sustain pedal also drives the recording's
        // damper model, so a pedalled take plays and replays as pedalled (sostenuto and soft
        // colour the live sound but not the recorded note lengths). No pedal ever touches
        // the matcher — the key press alone still decides when a note counts.
        onPedal: (pedal, down, timestamp) => {
            synth.setPedal(pedal, down);
            if (pedal === "sustain") {
                capturePedal(captureRef.current, down, timestamp);
            }
        },
    });
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
        // A tap with the loop off puts the cursor at that bar, so Practice and Listen
        // pick up from the tapped spot instead of the top or the last handoff.
        onBareClick: (bar) => {
            const osmd = getOsmd();
            if (!osmd) {
                return;
            }
            seekToBar(osmd.cursor, bar);
            osmd.cursor.show();
            centerCursor();
        },
    });

    // A practice run in progress holds the app-wide activity signal, so a
    // service-worker reload arriving mid-run waits until the run ends. The
    // effect cleanup ends it on finish, abort or unmount alike.
    useEffect(() => {
        if (!matcher.practicing) {
            return;
        }
        return services.activity.begin();
    }, [matcher.practicing, services.activity]);

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
        const frame = scheduler.frame(() => {
            gradePanelRef.current?.scrollIntoView({
                behavior: smooth ? "smooth" : "auto",
                block: "center",
            });
        });
        return () => scheduler.cancelFrame(frame);
    }, [runResult.grade, scheduler]);

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
        // Grade the run from its cleared notes' timing and velocity — none of which needs the
        // final note's key-up. The take (which does need the real hold) is saved separately
        // once the last note is released, so the grade and stats land now while a held note
        // still rings.
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
        finishedGradeRef.current = outcome.grade;
        runResult.record({ ...outcome, notes });
        // The finish half of the run funnel: which grade a completed self-paced run
        // earned, and how clean it was, against the run_started that opened it.
        analytics.track("run_completed", {
            mode: "self_paced",
            grade: outcome.grade.letter,
            correct: matcher.total,
            wrong: matcher.wrong,
            daily: daily !== undefined,
        });
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

    // Keep the finished run as a take without a separate Save press — finishing a song and
    // later finding Runs empty reads as data loss. This waits until the last note is released
    // (holdingNote) so the take records the note's real hold, not the beat the run completed
    // on; a note still down at the finish never received its key-up until now. flushHolds then
    // finds the release already recorded and is a no-op — it only bites the leave-mid-hold
    // fallback below, closing the hold at that instant rather than a clipped beat. The result
    // panel's saved/failed note reflects how the write landed.
    // biome-ignore lint/correctness/useExhaustiveDependencies: saveTake is a per-render closure; the takeSavedRef latch pins this to one save per run
    useEffect(() => {
        if (!matcher.complete || ephemeral || takeSavedRef.current || holdingNote) {
            return;
        }
        takeSavedRef.current = true;
        flushHolds(captureRef.current, scheduler.now());
        saveTake(finishedGradeRef.current);
    }, [matcher.complete, holdingNote, ephemeral]);

    // Finishing a run leaves full-screen play, so the grade, share card and per-note
    // strip — all hidden while full screen to keep the play surface clean — come into
    // view. Without this a completed full-screen run looks stuck: the score just ends
    // with nothing shown. The hook's fullscreenchange sync keeps state honest if the
    // player has already left on their own. The exit waits while the player still holds
    // a key so the final note rings out for as long as it is held rather than being cut
    // off the instant the last note lands; releasing it drops out of full screen.
    useEffect(() => {
        if (matcher.complete && fullscreen && !holdingNote) {
            exitFullscreen();
        }
    }, [matcher.complete, fullscreen, holdingNote, exitFullscreen]);

    // Leaving the play surface — the ✕, Esc, or a finished run dropping out — ends any
    // run in progress, but keeps the cursor where it is (stop hides, never rewinds), so
    // re-entering Practice or Listen picks up from the same place. A run that finished on
    // its own has already stopped; this covers stepping out mid-run.
    // biome-ignore lint/correctness/useExhaustiveDependencies: stopListen/stopKeepUp/matcher.stop reset transient playback, not render inputs
    useEffect(() => {
        if (!fullscreen) {
            listenPlayback.stop();
            // Leaving with a finished run whose take is still pending (the player stepped out
            // while holding the last note) saves it now, before matcher.stop() clears the
            // completion the deferred save waits on — its hold is closed at this instant.
            if (matcher.complete && !ephemeral && !takeSavedRef.current) {
                takeSavedRef.current = true;
                flushHolds(captureRef.current, scheduler.now());
                saveTake(finishedGradeRef.current);
            }
            // A tempo-locked play-along drives the cursor from its own timers and funnels
            // every note into the run; without tearing it down here, leaving full screen
            // freezes it mid-run and strands note input until Stop.
            keepUp.stop();
            matcher.stop();
            // Stepping out mid-run must never leave the resting score half blank.
            hidden.restore();
            // Silence any guide voice still ringing — leaving the surface ends the run,
            // so nothing should sound on. A safety net over the held-key press gate: even
            // an orphaned or pedal-sustained voice can't outlive the surface.
            synth.silenceAll();
        }
    }, [fullscreen]);

    // The audio engine's voices live for the whole process (a module singleton), so
    // navigating away from the play route must silence them too — the effect above only
    // fires on a fullscreen change, never on unmount.
    useEffect(() => () => synth.silenceAll(), [synth]);

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
        // With hidden notes on, Listen is the "hear it first" half of ear practice:
        // the phrase sounds over a blanked staff, ready to be played back.
        hidden.conceal();
        listenPlayback.start(from);
        analytics.track("run_started", { mode: "listen", hidden: hiddenNotes });
    };

    // Restart Listen from the top (or the loop's start bar). The trail wipes like a
    // fresh practice run, so the blue tells the story of this pass only.
    const restartListen = () => {
        if (!listenPlayback.playing) {
            return;
        }
        listenPlayback.stop();
        if (score.painted()) {
            score.wipePaint();
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
        // Keep-up is read-at-tempo: a blanked staff would be unreadable, so the
        // hidden-notes game stays a self-paced feature.
        hidden.restore();
        clearSelfPacedResult();
        if (score.painted()) {
            score.wipePaint();
        }
        const runHand = staffCount < 2 ? "both" : hand;
        const accompany = duet && staffCount >= 2 && hand !== "both";
        keepUp.start({ hand: runHand, guideNotes, accompany });
        analytics.track("run_started", {
            mode: "keep_up",
            hand: runHand,
            guide: guideNotes,
            duet: accompany,
        });
    };

    // Save the just-finished run as a take: rebuild a Composition from the captured
    // steps (their played onsets, pitches and velocity) and store it under this song.
    // The grade arrives as a parameter because the completion effect saves before the
    // recorded result has re-rendered into runResult.grade.
    const saveTake = (grade: Grade | null) => {
        const steps: RunStep[] = captureRef.current.notes.map((note) => ({
            pitches: note.pitches,
            startMs: note.playedMs,
            velocity: note.velocity,
            heldMs: note.heldMs,
            // The notated onset, so a note with no measured hold can't ring
            // longer than the score says while the player hunts for the next key.
            targetMs: note.targetMs,
        }));
        if (steps.length === 0) {
            return;
        }
        const take: Take = {
            id: crypto.randomUUID(),
            createdAt: Date.now(),
            letter: grade?.letter ?? "",
            complete: matcher.complete,
            metrics: grade,
            composition: compositionFromRun(
                steps,
                tempo,
                beatsPerBar ?? 4,
                captureRef.current.imprecise,
            ),
        };
        runResult.markSaved(takesList.save(take));
    };
    const saveCurrentTake = () => saveTake(runResult.grade);

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
        takesList.remove(takeId);
    };

    const practice = (resume = true) => {
        // A completed run whose auto-take-save is still pending — the player pressed Practice
        // or Restart while still holding the final note, before its release fired the deferred
        // save — would be lost once the capture and completion latch are replaced below. Save
        // it first, closing its hold at this instant, exactly as leaving the surface does.
        if (matcher.complete && !ephemeral && !takeSavedRef.current) {
            takeSavedRef.current = true;
            flushHolds(captureRef.current, scheduler.now());
            saveTake(finishedGradeRef.current);
        }
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
        // The sustain pedal held down as the run begins is invisible to a fresh capture —
        // Web MIDI streams pedal changes, never the standing state — so its first notes would
        // record dry despite ringing under the damper. Seed the capture from the live pedal,
        // on the same clock every hold is stamped with (the seed's time is unused while the
        // pedal stays down, but sharing the origin keeps the capture single-clock throughout).
        if (pedalHeld("sustain")) {
            capturePedal(captureRef.current, true, scheduler.now());
        }
        gradeFromRunRef.current = false;
        gradedRef.current = false;
        takeSavedRef.current = false;
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
            score.wipePaint();
            // A fresh render rebuilt the SVG, so any previous blanks are gone with it;
            // forget them and blank the new elements below.
            hidden.restore();
        }
        // Blank the noteheads (a no-op unless hidden-notes is on, or when a resumed
        // run is already concealed). Runs before the matcher seeks the cursor — the
        // collection walk resets it.
        hidden.conceal();
        // Arm the ghost race post-render, so its marker moves along the freshly drawn notes.
        ghostRace.arm({ partial, ephemeral, raceGhost, hand: matcherHand });
        // Read both hands off the freshly drawn score so the duet can sound the one
        // you're not practising (inert unless the duet is on).
        accompaniment.prime();
        // With the section loop on, Practice drills the selected bars on repeat, the
        // same range Listen laps, instead of running the whole piece once.
        matcher.start(from, loop.on ? { from: loop.from, to: loop.to } : null);
        analytics.track("run_started", {
            mode: "self_paced",
            hand: matcherHand,
            hidden: hiddenNotes,
            forgiving,
            loop: loop.on,
        });
    };

    // Reveal the next note by colour per the player's hint setting — always, only once
    // they've slipped at this position, or never. A wrong key flashes red regardless.
    // Writable from the Practice-tools drawer too, so the hint behaviour can change
    // without leaving the music; usePref persists it as the global setting.
    const [noteHints, setNoteHints] = usePref(prefsStore, "noteHints");
    // Which keys the on-screen keyboard lights as "play now". A keep-up run owns the
    // input on its own clock, so the keys follow its current beat (the matcher is
    // stopped, its `expected` frozen); self-paced follows the matcher, gated by the
    // reveal-hint setting. Either way "never" keeps the keyboard dark.
    const hintNotes =
        noteHints === "never"
            ? []
            : keepUp.running
              ? keepUp.expected
              : noteHints === "always" || (noteHints === "miss" && matcher.missedHere)
                ? matcher.expected
                : [];
    // A run ending — stop, restart or completion all drop `practicing` — leaves no
    // note left to hold, so drain any fills still shrinking.
    useEffect(() => {
        if (!matcher.practicing) {
            holdIndicator.clear();
        }
    }, [matcher.practicing, holdIndicator.clear]);

    // The run's tempo re-referenced to the piece's own, so the results panel reads the
    // lagging hand at the same scale the share grid was built with.
    const intendedTempo = initialTempo ?? runTempoRef.current;
    const runTempoScale = intendedTempo > 0 ? runTempoRef.current / intendedTempo : 1;

    // Dismiss the rotate-your-phone nudge, and remember the choice.
    const dismissRotate = () => {
        hints.markSeen(ROTATE_HINT_ID);
    };

    return {
        // Piece identity and framing.
        id,
        title,
        credit: credit ?? "",
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
        fingerStrip,
        setFingerStrip,
        runsView,
        showScore: () => onShowScore?.(),
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
        keyRange,
        hintNotes,
        holdFractions: holdIndicator.holdFractions,
        noteHints,
        setNoteHints,
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
        duet,
        setDuet,
        forgiving,
        setForgiving,
        raceGhost,
        setRaceGhost,
        hiddenNotes,
        setHiddenNotes,
        revealTries,
        setRevealTries,
        transpose,
        setTranspose,
        showMine,
        setShowMine,
        hasSaved,
        hand,
        setHand,
        // The piece's own MusicXML, for consumers that render their own staff
        // (the exported video's recognizable score).
        xml,
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
        // Saved takes.
        takes: takesList.takes,
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
