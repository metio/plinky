// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { Dispatch, SetStateAction } from "react";
import type { Hand } from "../../../core/matcher";
import { REVEAL_TRIES } from "../../../core/prefs";
import { m } from "../../paraglide/messages.js";
import { Bpm } from "../ui/bpm";
import { IconButton } from "../ui/button";
import { Disclosure } from "../ui/disclosure";
import { RotateIcon } from "../ui/icons";
import { Labeled, Option } from "../ui/option";
import { SegmentedControl } from "../ui/segmentedControl";
import { Stepper } from "../ui/stepper";
import { Switch } from "../ui/switch";
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
// hidden-notes ear practice, and the tempo trainer.
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
    } = usePlaySession();

    return (
        <Disclosure summary={m.run_setup()}>
            {staffCount >= 2 && (
                <Option caption={m.hand_caption()}>
                    <Labeled label={m.hand_label()}>
                        <SegmentedControl
                            options={(["both", "right", "left"] as const).map((option) => ({
                                id: option,
                                label: handLabel[option],
                            }))}
                            value={hand}
                            onChange={setHand}
                            label={m.hand_label()}
                            disabled={matcher.practicing}
                        />
                    </Labeled>
                </Option>
            )}
            <Option caption={m.keep_up_hint()}>
                <Switch
                    checked={enforceTempo}
                    onChange={setEnforceTempo}
                    label={m.keep_up_toggle()}
                />
            </Option>
            {enforceTempo && (
                <Option caption={m.guide_notes_hint()}>
                    <Switch
                        checked={guideNotes}
                        onChange={setGuideNotes}
                        label={m.guide_notes_toggle()}
                    />
                </Option>
            )}
            <Option caption={m.hidden_notes_hint()}>
                <Switch
                    checked={hiddenNotes}
                    onChange={setHiddenNotes}
                    label={m.hidden_notes_toggle()}
                />
            </Option>
            {hiddenNotes && (
                <Option caption={m.reveal_tries_caption()}>
                    <Labeled label={m.reveal_tries()}>
                        <SegmentedControl
                            options={REVEAL_TRIES.map((n) => ({ id: String(n), label: String(n) }))}
                            value={String(revealTries)}
                            onChange={(id) => setRevealTries(Number(id))}
                            label={m.reveal_tries()}
                        />
                    </Labeled>
                </Option>
            )}
            {!lockTempo && <TransposeRow transpose={transpose} setTranspose={setTranspose} />}
            {!lockTempo && (
                <Option caption={m.tempo_trainer_caption()}>
                    <Switch checked={trainerOn} onChange={setTrainerOn} label={m.tempo_trainer()} />
                </Option>
            )}
            {!lockTempo && trainerOn && (
                <Option caption={m.tempo_trainer_target_caption()}>
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
                </Option>
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
            <span className="text-xs text-gray-500 dark:text-gray-400">
                {m.transpose_caption()}
            </span>
        </span>
    );
}
