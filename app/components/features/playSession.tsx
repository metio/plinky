// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

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
import { tempoScale } from "../../../core/runOutcome";
import { gradeOf } from "../../../core/scoreDifficulty";
import { DEFAULT_KEY_RANGE, songKeyRange } from "../../../core/keyboardRange";
import type { Grade } from "../../../core/grade";
import type { DailyResult } from "../../../core/daily";
import type { Take } from "../../../core/takes";
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
import { useKeyLights } from "../../hooks/useKeyLights";
import { useHoldIndicator } from "../../hooks/useHoldIndicator";
import { useKeepUp } from "../../hooks/useKeepUp";
import { useListenPlayback } from "../../hooks/useListenPlayback";
import { useLoopSelection } from "../../hooks/useLoopSelection";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import { useMetronome } from "../../hooks/useMetronome";
import { useOsmdScore } from "../../hooks/useOsmdScore";
import { usePref } from "../../hooks/usePref";
import { useReadingMode } from "../../hooks/useReadingMode";
import { useEndRun } from "../../hooks/useEndRun";
import { useLatestPress } from "../../hooks/useLatestPress";
import { useNoteFunnel } from "../../hooks/useNoteFunnel";
import { useRunGrading } from "../../hooks/useRunGrading";
import { useRunRecorder } from "../../hooks/useRunRecorder";
import { useTakeAutosave } from "../../hooks/useTakeAutosave";
import { useRunResult } from "../../hooks/useRunResult";
import {
    collectSteps,
    type CorrectInfo,
    type Hand,
    useScoreMatcher,
} from "../../hooks/useScoreMatcher";
import { useHiddenNotes } from "../../hooks/useHiddenNotes";
import { useNoteLabels } from "../../hooks/useNoteLabels";
import { useSightRead } from "../../hooks/useSightRead";
import { useVanishingBars } from "../../hooks/useVanishingBars";
import { useSynth } from "../../hooks/useSynth";
import { useTempoControls } from "../../hooks/useTempoControls";
import { cursorWhole, seekToBar } from "../../lib/scoreCursor";
import { ASSISTED_COLOR, PLAYED_COLOR } from "../../../core/scoreCanvas";
import { paintPlayedNotes } from "../../lib/scoreColor";
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
    // Every graded run, ephemeral ones included — the placement test needs the score
    // of a drill it deliberately does not keep, which onRunComplete (skipped for an
    // ephemeral piece) cannot report.
    onGraded?: (grade: Grade) => void;
    initialTempo?: number;
    beatsPerBar?: number;
    lockTempo?: boolean;
    daily?: number;
    ephemeral?: boolean;
    // A run the placement test scores to find the player's level. It climbs past that
    // level on purpose, so its reading times are kept out of the per-note record.
    assessment?: boolean;
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
    onGraded,
    initialTempo,
    beatsPerBar,
    lockTempo,
    daily,
    ephemeral,
    assessment,
    canShareGhost,
    seededResult,
    runsView = false,
    onShowScore,
}: PlaySessionProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const rootRef = useRef<HTMLDivElement>(null);
    const gradePanelRef = useRef<HTMLDivElement>(null);
    // Claims the current attempt to start a run: a sight-read's study countdown lets
    // the player act again before the run begins, and only the newest press may start.
    const startPress = useLatestPress();
    // Step indices where a wrong key was played before the right one. A note cleared
    // from here reads amber rather than green: the score then shows where the run
    // actually hesitated, which a uniform green cannot.
    const stumbledRef = useRef<Set<number>>(new Set());
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
    // Focus mode: draw only the looped bars, re-engraved on their own. A session
    // toggle, and only ever meaningful with a loop set — there is no "just these
    // bars" without bars to mean.
    const [focusLoop, setFocusLoop] = useState(false);
    // The range OSMD is actually drawing. Held as state rather than derived inline
    // because the loop is built from the rendered bar boxes and so cannot exist until
    // after the score does — the reader of this value comes first in the file, and the
    // source of it comes later. Synced below, once both exist.
    const [focusRange, setFocusRange] = useState<{ from: number; to: number } | null>(null);
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
        adaptive,
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
    // This piece's first cold read, if it has ever had one. Subscribed rather than
    // read once, so a run that records one updates the panel without a re-mount; the
    // keyed store caches by stored string, so the snapshot is stable between writes.
    const sightReadRecord = useSyncExternalStore(
        services.sightReads.subscribe,
        () => services.sightReads.load(id),
        () => null,
    );
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
    // Keep-going mode, remembered across pieces; captured by the matcher at run start.
    const [forgiving, setForgiving] = usePref(prefsStore, "forgiving");
    const savedNoteLabels = useNoteLabels();
    // Reveal the next note by colour per the player's hint setting — always, only once
    // they've slipped at this position, or never. A wrong key flashes red regardless.
    // Writable from the Practice-tools drawer too, so the hint behaviour can change
    // without leaving the music; usePref persists it as the global setting.
    const [noteHints, setNoteHints] = usePref(prefsStore, "noteHints");
    const [keyLightsOn] = usePref(prefsStore, "keyLights");
    // Sight-read mode: one cold read of a piece with nothing to lean on. It owns the
    // aids for as long as it is on — turning it on strips them there and then, so what
    // you are about to attempt is visible before you commit to it, and no aid can flip
    // mid-run and re-render the score under the player.
    const sightRead = useSightRead({
        noteLabels: savedNoteLabels,
        noteHints,
        colorNotes: reading.colorNotes,
        forgiving,
        highway: reading.highway,
    });

    // The run's recording, and the run-scoped tempo/partial bookkeeping that travels with
    // it. Six callers that never meet share this one capture — the matcher's cleared
    // callback, the MIDI release and pedal handlers, the run starter, the grader and the
    // take save — so it is owned in one place with a named method per reason.
    const recorder = useRunRecorder(initialTempo ?? 100, easeToward);
    const aids = sightRead.aids;
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
    // fingering drill's home now that its tab is gone. Takes a plain boolean rather
    // than React's updater form: deciding whether this counts as "opened" meant
    // calling an updater to look at its result, and React calls it again itself — so
    // the function ran twice, against a value from this render rather than the live one.
    const setFingerStrip = (open: boolean) => {
        if (open) {
            onboarding.markDiscovered("fingeringTried");
        }
        setFingerStripState(open);
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
        showAccompaniment: reading.showAccompaniment,
        colorNotes: aids.colorNotes,
        focus: focusRange,
        showFingerings,
        scrollFollow,
        onReload: () => {
            listenPlayback.stop();
            keepUp.stop();
            matcher.stop();
            // A run already on its way — a sight-read counting down before it begins —
            // must not arrive after the player has stopped. Dropping the claim stops the
            // start; cancelling the countdown stops the timer and clears it off screen,
            // which it would otherwise keep ticking on a surface nobody is looking at.
            startPress.cancel();
            sightRead.cancel();
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
        onFingeringRedraw: () => {
            hidden.reconceal();
            vanishing.rearm();
        },
    });
    const { getOsmd, ready, staffCount, measureCount, measureBoxes, centerCursor, markPainted } =
        score;

    // The hand the run drills. A single-staff piece has no hand to choose — the selector
    // never shows for one — so it is always both. Derived once: the matcher, the ghost,
    // the duet, the reading aids and the two analytics events all have to name the same
    // hand, and six copies of the same ternary is six chances for one to drift.
    const activeHand: Hand = staffCount < 2 ? "both" : hand;

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

    // A song_opened event per piece put on the stand. This session is the single funnel
    // every surface loads a piece through — the play route, the daily challenge, a review
    // step, a warm-up — so one effect here covers them all. It waits for `ready` so the
    // staff count is the engraved truth, and keys on the content id, so moving to another
    // piece reports again while a re-render never does. Only the piece's shape travels:
    // an imported score's title is the player's own.
    // biome-ignore lint/correctness/useExhaustiveDependencies: id is the piece-change trigger; grade/staffCount are read at that moment
    useEffect(() => {
        if (!ready) {
            return;
        }
        analytics.track("song_opened", {
            grade,
            daily: daily !== undefined,
            ephemeral: ephemeral === true,
            two_hands: staffCount >= 2,
        });
    }, [analytics, ready, id]);

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

    // The finish half of the keep-up funnel, mirroring the self-paced run_completed that
    // the completion effect sends. A result appears only when a run reached the end — an
    // early stop scores nothing and clears it — so the transition to non-null IS the
    // completion, and the run's own settings are reported the way run_started reported them.
    // biome-ignore lint/correctness/useExhaustiveDependencies: the result's arrival is the event; the run's settings are read at that moment
    useEffect(() => {
        if (!keepUp.result) {
            return;
        }
        analytics.track("run_completed", {
            mode: "keep_up",
            grade: keepUp.result.letter,
            in_time: keepUp.result.inTime,
            total: keepUp.result.total,
            hand: activeHand,
            guide: guideNotes,
            daily: daily !== undefined,
        });
    }, [analytics, keepUp.result]);

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
    // The read-ahead drill: bars vanish behind the run so the eyes cannot go back.
    // Armed only while sight-read mode asks for it.
    // Self-paced only: the drill hides the bar you have moved past, which it learns
    // from the matcher's cleared-step index. A tempo-locked run walks its own step
    // list on the clock (core/keepUp collects every cursor position, not just the
    // playable ones), so its indices address different notes and would take away
    // the wrong bars.
    const vanishing = useVanishingBars(getOsmd, {
        enabled: sightRead.on && sightRead.vanish && !enforceTempo,
        hand: activeHand,
    });
    const hidden = useHiddenNotes(getOsmd, {
        enabled: hiddenNotes,
        tries: revealTries,
        hand: activeHand,
    });
    // Turning the mode off mid-piece must bring the music back immediately.
    useEffect(() => {
        if (!hiddenNotes) {
            hidden.restore();
        }
    }, [hiddenNotes, hidden.restore]);
    useEffect(() => {
        if (!sightRead.on || !sightRead.vanish || enforceTempo) {
            vanishing.restore();
        }
    }, [sightRead.on, sightRead.vanish, enforceTempo, vanishing.restore]);
    // The microphone as an input: while it listens, the player already hears
    // their real piano, so echoing the note back through the synth only doubles
    // the sound and feeds the app's own output into the mic. (The session already
    // subscribes to this context via useMidiConnected, so reading it is free.)
    const { micStatus, pedalHeld, echoNote, silenceEcho, keyLights } = useMidiConnection();
    const micListening = micStatus === "listening";

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
        forgiving: aids.forgiving,
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
                    if (funnel.isHeld(pitch)) {
                        synth.pressNote(pitch, { velocity: info.velocity });
                    }
                }
            }
            // A hidden note earned its reveal — lift the blank before the green
            // paint below, so the note appears already coloured.
            // Green for a clean read, amber for one that took a wrong key first.
            const foundColor = stumbledRef.current.has(info.index) ? ASSISTED_COLOR : PLAYED_COLOR;
            hidden.revealCorrect(info.index, foundColor);
            // Take away whatever bar the run has now left behind (inert unless the
            // read-ahead drill is armed).
            vanishing.advance(info.index);
            // Colour the notes just cleared — the cursor is still on them, as it
            // only advances after this callback — so the score shows progress.
            const osmd = getOsmd();
            if (osmd) {
                paintPlayedNotes(osmd, info.pitches, foundColor);
                markPainted();
            }
            // Show how long to keep holding, but only in the full-guidance hint mode
            // — the same beginner crutch the pre-highlight belongs to. A sight-reader
            // who dialled hints down gets no afterglow.
            if (aids.noteHints === "always") {
                holdIndicator.begin(info.pitches, info.holdMs);
            }
            // Record the cleared note — its timing, a hold per pitch for the release
            // to close — and ease the adaptive metronome toward the player's own pace.
            recorder.cleared(info);
            // Sound the sitting-out hand across the gap up to your next note, laid
            // out at the pace you're playing at right now (a no-op unless the duet is
            // on). Uses the live tempo captured for this render, so it tracks the same
            // adaptive pace the metronome eases toward.
            accompaniment.onCleared(info.index, liveTempo);
        },
        onWrong: ({ index, misses }) => {
            stumbledRef.current.add(index);
            // The tries budget spent on a hidden note reveals it red — the lesson
            // arrives, and (keep-going aside) the run still waits for the right key.
            hidden.revealMissed(index, misses);
            markPainted();
        },
    });
    // Keys the player is holding down right now. A finished run defers leaving full
    // screen while any of these ring, so the last note plays out for as long as it is
    // held instead of being cut off the instant the run completes.
    const funnel = useNoteFunnel({
        keepUpActive: keepUp.active,
        registerKeepUp: keepUp.registerNote,
        registerNote: matcher.registerNote,
        markImprecise: recorder.markImprecise,
        recordRelease: recorder.released,
        recordPedal: recorder.pedal,
        releaseVoice: synth.releaseNote,
        setPedal: synth.setPedal,
    });
    const holdingNote = funnel.holding;
    useMidiInput(funnel.listener);
    const connected = useMidiConnected();

    // The ghost race — a previous run replayed against the clock on the staff and the
    // race track. Armed at run start; the run clock's zero is the capture's startedAt.
    const runStartedAt = useCallback(() => recorder.startedAt(), [recorder]);
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

    // A loop turned off (or never set) leaves the whole piece drawn, so the mode can be
    // left on without stranding the reader on a range that no longer applies. Keyed on
    // the numbers rather than an object, so this settles rather than re-firing.
    const focusOn = focusLoop && loop.on;
    useEffect(() => {
        setFocusRange(focusOn ? { from: loop.from, to: loop.to } : null);
    }, [focusOn, loop.from, loop.to]);

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
        // Light the notes on a connected instrument as Listen plays them, and let
        // them go the moment playback stops.
        echoNote,
        silenceEcho,
    });

    // Re-centre the treadmill as the matcher advances through the piece — the cursor
    // position isn't a value centerCursor reads, so depend on done/practicing to fire it.
    // biome-ignore lint/correctness/useExhaustiveDependencies: done/practicing are the advance signal, not centerCursor inputs
    useEffect(() => {
        centerCursor();
    }, [centerCursor, matcher.done, matcher.practicing]);

    // Grade a run once it completes. The whole decision lives in useRunGrading, which
    // needs none of the surface — only the matcher's counters and the capture — so a
    // finished run can be driven through it in a test without a rendered staff.
    const grading = useRunGrading({
        complete: matcher.complete,
        holdingNote,
        correct: matcher.total,
        wrong: matcher.wrong,
        capture: recorder.capture,
        runTempo: recorder.tempo,
        intendedTempo: initialTempo,
        partial: recorder.partial,
        id,
        title,
        daily,
        ephemeral,
        assessment,
        looped: loop.on,
        sightReading: sightRead.on,
        atTempo: enforceTempo,
        services,
        analytics,
        playNote: synth.playNote,
        publishMilestone,
        recordResult: runResult.record,
        bumpTempo,
        adoptOwnRun: ghostRace.adoptOwnRun,
        onGraded,
        onRunComplete,
    });

    // Keeping the finished run without a Save press. The hook owns the one-per-run latch
    // and every way out of a run that still owes a take — see useTakeAutosave for why the
    // save waits on the last key coming up.
    const takes = useTakeAutosave({
        complete: matcher.complete,
        holdingNote,
        ephemeral,
        capture: recorder.capture,
        tempo,
        beatsPerBar,
        finishedGrade: grading.finishedGrade,
        save: takesList.save,
        onSaved: runResult.markSaved,
        now: scheduler.now,
    });

    // When a run finishes, bring the result into view: the player's eyes are on the
    // keyboard, and the grade renders below it (and below the whole score on the way
    // out of full screen), so it can otherwise land off-screen unnoticed. Honour
    // reduced-motion, and wait a frame so the post-run layout has settled first.
    // Re-opening a finished daily seeds the grade on mount; that must not yank the
    // page down, so scroll only for a run completed in this session.
    useEffect(() => {
        if (!runResult.grade || !grading.fromRun()) {
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
    }, [runResult.grade, scheduler, grading]);

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

    // Ending a run when the surface goes quiet. The order is the logic — see useEndRun,
    // which also silences the module-singleton audio engine on unmount.
    useEndRun({
        active: fullscreen,
        stopListen: listenPlayback.stop,
        gradeOwedRun: grading.gradeIfOwed,
        saveOwedTake: takes.saveIfOwed,
        stopKeepUp: keepUp.stop,
        stopMatcher: matcher.stop,
        cancelPendingStart: () => {
            startPress.cancel();
            sightRead.cancel();
        },
        restoreScore: () => {
            hidden.restore();
            vanishing.restore();
        },
        silence: () => {
            synth.silenceAll();
            silenceEcho();
            // Everything else going out stops here, and a lit key is going out too —
            // left alone it would still be glowing on an instrument nobody is playing.
            keyLights.clear();
        },
    });

    // A keyboard that lights its own keys shows the position the run is on, from the
    // same look-ahead the notes highway draws. `aids.noteHints` is the policy already
    // resolved for this run, so a sight-read arrives here as "never" and needs no
    // second check.
    useKeyLights({
        lights: keyLights,
        enabled: keyLightsOn,
        practicing: matcher.practicing,
        hints: aids.noteHints,
        missedHere: matcher.missedHere,
        upcoming: matcher.upcoming,
    });

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
        // hidden-notes game stays a self-paced feature, and the read-ahead drill
        // likewise gives the whole score back for the run.
        hidden.restore();
        vanishing.restore();
        clearSelfPacedResult();
        if (score.painted()) {
            score.wipePaint();
        }
        const accompany = duet && staffCount >= 2 && hand !== "both";
        keepUp.start({ hand: activeHand, guideNotes, accompany });
        analytics.track("run_started", {
            mode: "keep_up",
            hand: activeHand,
            guide: guideNotes,
            duet: accompany,
        });
    };

    const saveCurrentTake = () => takes.saveNow(runResult.grade);

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
        const isMine = startPress.press();
        // A completed run whose auto-take-save is still pending — the player pressed Practice
        // or Restart while still holding the final note, before its release fired the deferred
        // save — would be lost once the capture and completion latch are replaced below. Save
        // it first, closing its hold at this instant, exactly as leaving the surface does.
        takes.saveIfOwed();
        // Take over at the cursor's current position when resuming (handing over from
        // Listen, or continuing a run stopped partway); Restart passes resume=false to
        // begin at the top. The top of a fresh piece reads as 0 either way.
        const from = resume ? resumePoint() : 0;
        const partial = from > 0;
        enterPlayFullscreen();
        listenPlayback.stop();
        clearSelfPacedResult();
        recorder.begin({
            tempo,
            partial,
            pedalDown: pedalHeld("sustain"),
            at: scheduler.now(),
        });
        grading.reset();
        stumbledRef.current.clear();
        takes.reset();
        keepUp.clearResult();
        resyncLive();
        // The hand the matcher and the ghost step through: the whole grand staff
        // when there's a single staff, otherwise the hand being drilled. (Fingering
        // is printed on the staff at load time, not computed per run.)
        // A fresh run from the top wipes the previous run's colours for a clean slate; a
        // resumed run (taking over from Listen) keeps them, so the blue Listen trail and
        // any earlier green survive and the score shows how the whole piece was played.
        if (!partial && score.painted()) {
            score.wipePaint();
            // A fresh render rebuilt the SVG, so any previous blanks are gone with it;
            // forget them and blank the new elements below.
            hidden.restore();
            vanishing.restore();
        }
        // Blank the noteheads (a no-op unless hidden-notes is on, or when a resumed
        // run is already concealed). Runs before the matcher seeks the cursor — the
        // collection walk resets it.
        hidden.conceal();
        // Same for the read-ahead drill, which walks the cursor the same way.
        vanishing.arm();
        // Arm the ghost race post-render, so its marker moves along the freshly drawn notes.
        ghostRace.arm({ partial, ephemeral, raceGhost, hand: activeHand });
        // Read both hands off the freshly drawn score so the duet can sound the one
        // you're not practising (inert unless the duet is on).
        accompaniment.prime();
        // Everything above prepares the run; this starts it. Held apart because a
        // sight-read waits out its study countdown first, and in that gap the player
        // can press Listen, Stop or Practice again — so the start is claimed by a
        // token and dropped if anything since has taken the surface. Without that, a
        // countdown resolving late would start a run over whatever is now playing.
        const begin = () => {
            if (!isMine() || listenPlayback.active() || keepUp.active()) {
                return;
            }
            // With the section loop on, Practice drills the selected bars on repeat, the
            // same range Listen laps, instead of running the whole piece once.
            matcher.start(from, loop.on ? { from: loop.from, to: loop.to } : null);
            analytics.track("run_started", {
                mode: "self_paced",
                hand: activeHand,
                hidden: hiddenNotes,
                forgiving,
                loop: loop.on,
                // The session-only view toggles. They never reach the preferences store, so
                // no setting_changed reports them; carrying them here records how the run was
                // actually set up, which is what the toggle was a proxy for anyway.
                fingerings: reading.showFingerings,
                follow: reading.scrollFollow,
                trainer: trainerOn,
            });
        };
        // A sight-read gets its moment to take the piece in first — key, metre, shape —
        // exactly as a real sight-reading test does. Off the mode, the run starts now:
        // deferring every run by even a microtask would let a Listen pressed straight
        // after Practice be overtaken by the run it just replaced.
        if (sightRead.on) {
            // A cancelled countdown never resolves, so the run it belonged to is
            // simply never started. Should the countdown ever fail instead, the run
            // stays unstarted rather than surfacing as an unhandled rejection.
            void sightRead.study().then(begin, () => {});
            return;
        }
        begin();
    };

    // Which keys the on-screen keyboard lights as "play now". A keep-up run owns the
    // input on its own clock, so the keys follow its current beat (the matcher is
    // stopped, its `expected` frozen); self-paced follows the matcher, gated by the
    // reveal-hint setting. Either way "never" keeps the keyboard dark.
    const hintNotes = ((): number[] => {
        if (aids.noteHints === "never") {
            return [];
        }
        // A keep-up run owns the input on its own clock, so the keys follow its beat.
        if (keepUp.running) {
            return keepUp.expected;
        }
        const helping =
            aids.noteHints === "always" || (aids.noteHints === "miss" && matcher.missedHere);
        return helping ? matcher.expected : [];
    })();
    // A run ending — stop, restart or completion all drop `practicing` — leaves no
    // note left to hold, so drain any fills still shrinking.
    useEffect(() => {
        if (!matcher.practicing) {
            holdIndicator.clear();
        }
    }, [matcher.practicing, holdIndicator.clear]);

    // The run's tempo re-referenced to the piece's own, so the results panel reads the
    // lagging hand at the same scale the share grid was built with.
    const runTempoScale = tempoScale(
        recorder.tempo.current,
        initialTempo ?? recorder.tempo.current,
    );

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
        trainerOn,
        setTrainerOn,
        trainerTarget,
        setTrainerTarget,
        metronomeOn,
        setMetronomeOn,
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
        focusLoop,
        setFocusLoop,
        // Sight-read mode and its study countdown.
        sightRead,
        // The aids a run actually reads with — the player's own settings, or the
        // sight-reader rung while the mode is on. Every surface reads these rather
        // than the stored preferences, so the override cannot be half-applied.
        aids,
        // What this piece scored the first time it was ever read cold, or null when it
        // has never been sight-read here.
        sightReadRecord,
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
                            ? "fixed inset-0 z-50 flex flex-col gap-2 bg-surface p-3"
                            : "space-y-3"
                    }
                >
                    {children}
                </div>
            </FullscreenProvider>
        </PlaySessionContext.Provider>
    );
}
