// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { Dispatch, ReactNode, SetStateAction } from "react";
import { BARS_PER_ROW, KEYBOARD_OCTAVES, type NoteHints, REVEAL_TRIES } from "../../../core/prefs";
import type { Hand } from "../../../core/matcher";
import { m } from "../../paraglide/messages.js";
import { Bpm } from "../ui/bpm";
import { IconButton } from "../ui/button";
import { FieldGroup } from "../ui/disclosure";
import { Drawer } from "../ui/drawer";
import { RotateIcon } from "../ui/icons";
import { SegmentedControl } from "../ui/segmentedControl";
import { BumpValue, Stepper } from "../ui/stepper";
import { Switch } from "../ui/switch";

// A lead-in label for a selector or slider, so each control names itself without a
// separate heading per row.
function Labeled({ label, children }: { label: ReactNode; children: ReactNode }) {
    return (
        <span className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <span>{label}</span>
            {children}
        </span>
    );
}

// A control paired with a caption beneath it, so each option explains what it does — and
// what its values mean — inline, rather than leaving the help to a tooltip that never
// shows on touch. Full width, so the options stack one per row with room for the caption.
function Option({ caption, children }: { caption: string; children: ReactNode }) {
    return (
        <span className="flex w-full flex-col gap-1">
            {children}
            <span className="text-xs text-gray-500 dark:text-gray-400">{caption}</span>
        </span>
    );
}

const noteHintLabel: Record<NoteHints, string> = {
    always: m.note_hints_always(),
    miss: m.note_hints_miss(),
    never: m.note_hints_never(),
};

const handLabel: Record<Hand, string> = {
    both: m.hand_both(),
    right: m.hand_right(),
    left: m.hand_left(),
};

// Every per-piece play setting, in one drawer opened from the Practice-tools button (at
// rest and in the full-screen transport) and portaled above the score, so the resting
// view stays uncluttered and the settings are reachable mid-play. Purely presentational:
// the play surface owns the state that drives playback and passes it in, so the drawer
// only reads values and reports edits back.
export function PracticeToolsDrawer({
    open,
    onClose,
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
    noteHints,
    setNoteHints,
    raceGhost,
    setRaceGhost,
    hiddenNotes,
    setHiddenNotes,
    revealTries,
    setRevealTries,
    staffCount,
    hand,
    setHand,
    practicing,
    loopAvailable,
    loopOn,
    onToggleLoop,
    showTranspose,
    transpose,
    setTranspose,
    showMineAvailable,
    showMine,
    setShowMine,
    treadmill,
    setTreadmill,
    barNumbers,
    setBarNumbers,
    barsPerRow,
    setBarsPerRow,
    keyboardOctaves,
    onKeyboardOctaves,
}: {
    open: boolean;
    onClose: () => void;
    lockTempo?: boolean;
    tempo: number;
    setTempo: (value: number) => void;
    trainerOn: boolean;
    setTrainerOn: (value: boolean) => void;
    trainerTarget: number;
    setTrainerTarget: (value: number) => void;
    metronomeOn: boolean;
    setMetronomeOn: (value: boolean) => void;
    adaptive: boolean;
    setAdaptive: (value: boolean) => void;
    liveTempo: number;
    subdivision: number;
    setSubdivision: (value: number) => void;
    enforceTempo: boolean;
    setEnforceTempo: (value: boolean) => void;
    guideNotes: boolean;
    setGuideNotes: (value: boolean) => void;
    forgiving: boolean;
    setForgiving: (value: boolean) => void;
    noteHints: NoteHints;
    setNoteHints: (value: NoteHints) => void;
    raceGhost: boolean;
    setRaceGhost: (value: boolean) => void;
    hiddenNotes: boolean;
    setHiddenNotes: (value: boolean) => void;
    revealTries: number;
    setRevealTries: (value: number) => void;
    staffCount: number;
    hand: Hand;
    setHand: (value: Hand) => void;
    // Locked mid-run so the matched note count stays honest.
    practicing: boolean;
    // The score is loaded and has more than one bar, so a loop range is meaningful.
    loopAvailable: boolean;
    loopOn: boolean;
    onToggleLoop: (next: boolean) => void;
    // A transposable piece (not a locked challenge, which stays identical for everyone).
    showTranspose: boolean;
    transpose: number;
    setTranspose: Dispatch<SetStateAction<number>>;
    // The player has worked out their own fingering for this piece and the staff is
    // showing fingering, so offering theirs over the app's suggestion is meaningful.
    showMineAvailable: boolean;
    showMine: boolean;
    setShowMine: (value: boolean) => void;
    treadmill: boolean;
    setTreadmill: (value: boolean) => void;
    barNumbers: boolean;
    setBarNumbers: (value: boolean) => void;
    barsPerRow: number;
    setBarsPerRow: (value: number) => void;
    keyboardOctaves: number;
    onKeyboardOctaves: (value: number) => void;
}) {
    return (
        <Drawer open={open} onClose={onClose} title={m.more_options()}>
            <FieldGroup label={`🎵 ${m.group_tempo()}`}>
                {lockTempo ? (
                    <Labeled label={m.scores_tempo()}>
                        <Bpm tempo={tempo} />
                    </Labeled>
                ) : (
                    <Option caption={m.tempo_caption()}>
                        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                            <span>{m.scores_tempo()}</span>
                            <input
                                type="range"
                                min={40}
                                max={180}
                                value={tempo}
                                onChange={(event) => setTempo(Number(event.target.value))}
                                aria-label={m.scores_tempo()}
                            />
                            <BumpValue
                                value={tempo}
                                className="w-12 font-semibold text-gray-800 dark:text-gray-200"
                            />
                        </label>
                    </Option>
                )}
                {!lockTempo && (
                    <Option caption={m.tempo_trainer_caption()}>
                        <Switch
                            checked={trainerOn}
                            onChange={setTrainerOn}
                            label={m.tempo_trainer()}
                        />
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
            </FieldGroup>

            <FieldGroup label={`🥁 ${m.group_metronome()}`}>
                <Option caption={m.metronome_caption()}>
                    <Switch
                        checked={metronomeOn}
                        onChange={setMetronomeOn}
                        label={m.action_metronome()}
                    />
                </Option>
                {metronomeOn && (
                    <Option caption={m.metronome_adaptive_caption()}>
                        <Switch
                            checked={adaptive}
                            onChange={setAdaptive}
                            label={m.metronome_adaptive()}
                        />
                    </Option>
                )}
                {metronomeOn && adaptive && (
                    <Bpm tempo={liveTempo} className="text-sm text-gray-600 dark:text-gray-400" />
                )}
                {metronomeOn && (
                    <Option caption={m.metronome_subdivision_caption()}>
                        <Labeled label={m.metronome_subdivision()}>
                            <SegmentedControl
                                options={[1, 2, 3, 4].map((n) => ({
                                    id: String(n),
                                    label: String(n),
                                }))}
                                value={String(subdivision)}
                                onChange={(id) => setSubdivision(Number(id))}
                                label={m.metronome_subdivision()}
                            />
                        </Labeled>
                    </Option>
                )}
            </FieldGroup>

            <FieldGroup label={`🎯 ${m.group_practice()}`}>
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
                <Option caption={m.forgiving_hint()}>
                    <Switch
                        checked={forgiving}
                        onChange={setForgiving}
                        label={m.forgiving_toggle()}
                    />
                </Option>
                <Option caption={m.settings_note_hints_help()}>
                    <Labeled label={m.settings_note_hints()}>
                        <SegmentedControl
                            options={(["always", "miss", "never"] as const).map((option) => ({
                                id: option,
                                label: noteHintLabel[option],
                            }))}
                            value={noteHints}
                            onChange={setNoteHints}
                            label={m.settings_note_hints()}
                        />
                    </Labeled>
                </Option>
                <Option caption={m.race_ghost_hint()}>
                    <Switch
                        checked={raceGhost}
                        onChange={setRaceGhost}
                        label={m.race_ghost_toggle()}
                    />
                </Option>
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
                                options={REVEAL_TRIES.map((n) => ({
                                    id: String(n),
                                    label: String(n),
                                }))}
                                value={String(revealTries)}
                                onChange={(id) => setRevealTries(Number(id))}
                                label={m.reveal_tries()}
                            />
                        </Labeled>
                    </Option>
                )}
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
                                disabled={practicing}
                            />
                        </Labeled>
                    </Option>
                )}
                {loopAvailable && (
                    <Option caption={m.loop_caption()}>
                        <Switch checked={loopOn} onChange={onToggleLoop} label={m.loop_section()} />
                    </Option>
                )}
            </FieldGroup>

            {/* Skip the whole group when it would be empty — a locked challenge has no
                transpose, and most pieces have no saved fingering, so the heading would
                otherwise stand alone. */}
            {(showTranspose || showMineAvailable) && (
                <FieldGroup label={`🎼 ${m.group_notation()}`}>
                    {showTranspose && (
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
                                    onDecrement={() =>
                                        setTranspose((value) => Math.max(value - 1, -12))
                                    }
                                    onIncrement={() =>
                                        setTranspose((value) => Math.min(value + 1, 12))
                                    }
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
                    )}
                    {showMineAvailable && (
                        <Option caption={m.fingering_show_mine_caption()}>
                            <Switch
                                checked={showMine}
                                onChange={setShowMine}
                                label={m.fingering_show_mine()}
                            />
                        </Option>
                    )}
                </FieldGroup>
            )}

            <FieldGroup label={`🎨 ${m.group_layout()}`}>
                <Option caption={m.treadmill_hint()}>
                    <Switch
                        checked={treadmill}
                        onChange={setTreadmill}
                        label={m.treadmill_toggle()}
                    />
                </Option>
                <Option caption={m.bar_numbers_hint()}>
                    <Switch
                        checked={barNumbers}
                        onChange={setBarNumbers}
                        label={m.bar_numbers_toggle()}
                    />
                </Option>
                {/* Bars-per-row only shapes the wrapped layout; the treadmill is a single
                    line, so the control would do nothing there. */}
                {!treadmill && (
                    <Option caption={m.bars_per_row_caption()}>
                        <Labeled label={m.bars_per_row()}>
                            <SegmentedControl
                                options={BARS_PER_ROW.map((n) => ({
                                    id: String(n),
                                    label: n === 0 ? m.bars_per_row_auto() : String(n),
                                }))}
                                value={String(barsPerRow)}
                                onChange={(id) => setBarsPerRow(Number(id))}
                                label={m.bars_per_row()}
                            />
                        </Labeled>
                    </Option>
                )}
                <Option caption={m.keyboard_octaves_caption()}>
                    <Labeled label={m.keyboard_octaves()}>
                        <SegmentedControl
                            options={KEYBOARD_OCTAVES.map((n) => ({
                                id: String(n),
                                label: n === 0 ? m.keyboard_octaves_all() : String(n),
                            }))}
                            value={String(keyboardOctaves)}
                            onChange={(id) => onKeyboardOctaves(Number(id))}
                            label={m.keyboard_octaves()}
                        />
                    </Labeled>
                </Option>
            </FieldGroup>
        </Drawer>
    );
}
