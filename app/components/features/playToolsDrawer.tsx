// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { usePlaySession } from "./playSession";
import { PracticeToolsDrawer } from "./practiceToolsDrawer";

// The play-settings drawer, wired to the session: the live tweaks — tempo, metronome,
// keep-up, looping, transposition, fingering, the reading layout and the keyboard framing.
// A thin adapter — it reads the shared session and hands PracticeToolsDrawer its props.
export function PlayToolsDrawer() {
    const {
        toolsOpen,
        setToolsOpen,
        lockTempo,
        tempo,
        setTempo,
        metronomeOn,
        setMetronomeOn,
        adaptive,
        setAdaptive,
        liveTempo,
        subdivision,
        setSubdivision,
        forgiving,
        setForgiving,
        noteHints,
        setNoteHints,
        raceGhost,
        setRaceGhost,
        ready,
        measureCount,
        loop,
        hasSaved,
        showMine,
        setShowMine,
        reading,
        keyboardOctaves,
        setKeyboardOctaves,
        setKeyWindow,
    } = usePlaySession();

    return (
        <PracticeToolsDrawer
            open={toolsOpen}
            onClose={() => setToolsOpen(false)}
            lockTempo={lockTempo}
            tempo={tempo}
            setTempo={setTempo}
            metronomeOn={metronomeOn}
            setMetronomeOn={setMetronomeOn}
            adaptive={adaptive}
            setAdaptive={setAdaptive}
            liveTempo={liveTempo}
            subdivision={subdivision}
            setSubdivision={setSubdivision}
            forgiving={forgiving}
            setForgiving={setForgiving}
            noteHints={noteHints}
            setNoteHints={setNoteHints}
            raceGhost={raceGhost}
            setRaceGhost={setRaceGhost}
            loopAvailable={ready && measureCount > 1}
            loopOn={loop.on}
            onToggleLoop={(next) => {
                loop.toggle(next);
                // Turning the loop on closes the drawer: the bar-range controls and the
                // tap-two-bars score sit behind its backdrop, so leaving it open reads
                // as "loop did nothing".
                if (next) {
                    setToolsOpen(false);
                }
            }}
            showMineAvailable={hasSaved && reading.showFingerings}
            showMine={showMine}
            setShowMine={setShowMine}
            treadmill={reading.treadmill}
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
    );
}
