// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { usePlaySession } from "./playSession";
import { PracticeToolsDrawer } from "./practiceToolsDrawer";

// The play-settings drawer, wired to the session: tempo and the trainer, the metronome,
// keep-up, looping, transposition, fingering, the reading layout and the keyboard framing.
// A thin adapter — it reads the shared session and hands PracticeToolsDrawer its props.
export function PlayToolsDrawer() {
    const {
        toolsOpen,
        setToolsOpen,
        lockTempo,
        tempo,
        setTempo,
        trainerOn,
        setTrainerOn,
        trainerTarget,
        setTrainerTarget,
        metronomeOn,
        setMetronomeOn,
        adaptive,
        setAdaptive,
        liveTempo,
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
        staffCount,
        hand,
        setHand,
        matcher,
        ready,
        measureCount,
        loop,
        transpose,
        setTranspose,
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
