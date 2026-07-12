// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { Dispatch, SetStateAction } from "react";
import type { Hand } from "../../../core/matcher";
import { BARS_PER_ROW, REVEAL_TRIES } from "../../../core/prefs";
import { m } from "../../paraglide/messages.js";
import { Bpm } from "../ui/bpm";
import { IconButton } from "../ui/button";
import { Disclosure } from "../ui/disclosure";
import { ChoiceField, SwitchField } from "../ui/fields";
import { RotateIcon } from "../ui/icons";
import { Stepper } from "../ui/stepper";
import { usePlaySession } from "./playSession";

const handLabel: Record<Hand, string> = {
    both: m.hand_both(),
    right: m.hand_right(),
    left: m.hand_left(),
};

// The run-setup panel on the resting page: the settings that shape the run you
// are ABOUT to play — changing any of them mid-piece would mean starting over
// anyway, so they live before the run, behind one disclosure, instead of in the
// mid-play drawer: the hand to drill, tempo-locked keep-up, transposition,
// hidden-notes ear practice, and the tempo trainer. Every option renders through
// the same ChoiceField/SwitchField the Settings page uses, so a control looks
// and explains itself the same wherever it appears.
export function RunSetup() {
    const {
        lockTempo,
        staffCount,
        hand,
        setHand,
        matcher,
        enforceTempo,
        setEnforceTempo,
        guideNotes,
        setGuideNotes,
        transpose,
        setTranspose,
        hiddenNotes,
        setHiddenNotes,
        revealTries,
        setRevealTries,
        trainerOn,
        setTrainerOn,
        trainerTarget,
        setTrainerTarget,
        raceGhost,
        setRaceGhost,
        ready,
        measureCount,
        loop,
        hasSaved,
        showMine,
        setShowMine,
        reading,
    } = usePlaySession();

    return (
        <Disclosure summary={m.run_setup()}>
            {staffCount >= 2 && (
                <ChoiceField
                    label={m.hand_label()}
                    value={hand}
                    onChange={setHand}
                    options={(["both", "right", "left"] as const).map((option) => ({
                        id: option,
                        label: handLabel[option],
                    }))}
                    help={m.hand_caption()}
                    disabled={matcher.practicing}
                />
            )}
            <SwitchField
                label={m.keep_up_toggle()}
                checked={enforceTempo}
                onChange={setEnforceTempo}
                help={m.keep_up_hint()}
            />
            {enforceTempo && (
                <SwitchField
                    label={m.guide_notes_toggle()}
                    checked={guideNotes}
                    onChange={setGuideNotes}
                    help={m.guide_notes_hint()}
                />
            )}
            <SwitchField
                label={m.hidden_notes_toggle()}
                checked={hiddenNotes}
                onChange={setHiddenNotes}
                help={m.hidden_notes_hint()}
            />
            {hiddenNotes && (
                <ChoiceField
                    label={m.reveal_tries()}
                    value={String(revealTries)}
                    onChange={(id) => setRevealTries(Number(id))}
                    options={REVEAL_TRIES.map((n) => ({ id: String(n), label: String(n) }))}
                    help={m.reveal_tries_caption()}
                />
            )}
            {!lockTempo && <TransposeRow transpose={transpose} setTranspose={setTranspose} />}
            {!lockTempo && (
                <SwitchField
                    label={m.tempo_trainer()}
                    checked={trainerOn}
                    onChange={setTrainerOn}
                    help={m.tempo_trainer_caption()}
                />
            )}
            <SwitchField
                label={m.race_ghost_toggle()}
                checked={raceGhost}
                onChange={setRaceGhost}
                help={m.race_ghost_hint()}
            />
            {ready && measureCount > 1 && (
                <SwitchField
                    label={m.loop_section()}
                    checked={loop.on}
                    onChange={loop.toggle}
                    help={m.loop_caption()}
                />
            )}
            {hasSaved && reading.showFingerings && (
                <SwitchField
                    label={m.fingering_show_mine()}
                    checked={showMine}
                    onChange={setShowMine}
                    help={m.fingering_show_mine_caption()}
                />
            )}
            <SwitchField
                label={m.treadmill_toggle()}
                checked={reading.treadmill}
                onChange={reading.setTreadmill}
                help={m.treadmill_hint()}
            />
            <SwitchField
                label={m.bar_numbers_toggle()}
                checked={reading.barNumbers}
                onChange={reading.setBarNumbers}
                help={m.bar_numbers_hint()}
            />
            {!reading.treadmill && (
                <ChoiceField
                    label={m.bars_per_row()}
                    value={String(reading.barsPerRow)}
                    onChange={(id) => reading.setBarsPerRow(Number(id))}
                    options={BARS_PER_ROW.map((n) => ({
                        id: String(n),
                        label: n === 0 ? m.bars_per_row_auto() : String(n),
                    }))}
                    help={m.bars_per_row_caption()}
                />
            )}
            {!lockTempo && trainerOn && (
                <div className="space-y-1">
                    <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                        <span>{m.tempo_trainer_target()}</span>
                        <input
                            type="range"
                            min={40}
                            max={180}
                            value={trainerTarget}
                            onChange={(event) => setTrainerTarget(Number(event.target.value))}
                            aria-label={m.tempo_trainer_target()}
                        />
                        <Bpm tempo={trainerTarget} className="w-12" />
                    </label>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                        {m.tempo_trainer_target_caption()}
                    </p>
                </div>
            )}
        </Disclosure>
    );
}

// Transposition shifts the whole piece into a friendlier key before the run.
function TransposeRow({
    transpose,
    setTranspose,
}: {
    transpose: number;
    setTranspose: Dispatch<SetStateAction<number>>;
}) {
    return (
        <div className="space-y-1">
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
                    onDecrement={() => setTranspose((value) => Math.max(value - 1, -12))}
                    onIncrement={() => setTranspose((value) => Math.min(value + 1, 12))}
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
            <p className="text-xs text-gray-500 dark:text-gray-400">{m.transpose_caption()}</p>
        </div>
    );
}
