// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { m } from "../../paraglide/messages.js";
import { Button, IconButton } from "../ui/button";
import { Drawer } from "../ui/drawer";
import { GhostTrack } from "../ui/ghostTrack";
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
import { FocusStrip } from "./focusStrip";
import { FullScreen, Midi, Show } from "./conditional";
import { KeepUpResultCard } from "./keepUpResultCard";
import { LoopRangeBar } from "./loopRangeBar";
import { PianoKeyboard } from "./pianoKeyboard";
import { usePlaySession } from "./playSession";
import { PracticeToolsDrawer } from "./practiceToolsDrawer";
import { RunResult } from "./runResult";
import { TakesPanel } from "./takesPanel";

// The play surface: everything inside the full-screen shell. It owns no state — it reads
// the shared play session and reacts, arranging the transport bar, the score, the settings
// drawer, the practice stage, and the finished-run readouts.
export function PlaySurface() {
    const session = usePlaySession();
    const {
        id,
        title,
        daily,
        ephemeral,
        lockTempo,
        containerRef,
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
        getOsmd,
        ready,
        loadError,
        staffCount,
        measureCount,
        reading,
        keyWindow,
        setKeyWindow,
        keyboardOctaves,
        setKeyboardOctaves,
        hintNotes,
        focusXml,
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
        matcher,
        keepUp,
        listenPlayback,
        ghostRace,
        loop,
        runResult,
        runTempoScale,
        connected,
        status,
        requestAccess,
        takes,
        listen,
        practice,
        playAlong,
        saveCurrentTake,
        replayTake,
        deleteTake,
    } = session;
    const { showFingerings, setShowFingerings, treadmill, scrollFollow, setScrollFollow } = reading;

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
        <>
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
                            className={scrollFollow ? "text-indigo-600 dark:text-indigo-400" : ""}
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
                        ready && measureCount > 1 && !listenPlayback.playing && !matcher.practicing
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
                setTreadmill={reading.setTreadmill}
                barNumbers={reading.barNumbers}
                setBarNumbers={reading.setBarNumbers}
                barsPerRow={reading.barsPerRow}
                setBarsPerRow={reading.setBarsPerRow}
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
                                    onClick={dismissRotate}
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
                {runResult.grade && (
                    <div ref={gradePanelRef} className="space-y-3">
                        <RunResult
                            grade={runResult.grade}
                            notes={runResult.notes}
                            tolerance={runResult.tolerance}
                            grid={runResult.grid}
                            tempoCurve={runResult.tempoCurve}
                            tempoScale={runTempoScale}
                            daily={daily}
                            title={title}
                            ephemeral={ephemeral}
                            runSaved={runResult.saved}
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
        </>
    );
}
