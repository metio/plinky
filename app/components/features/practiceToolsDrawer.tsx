// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { BARS_PER_ROW, KEYBOARD_OCTAVES, type NoteHints } from "../../../core/prefs";
import { m } from "../../paraglide/messages.js";
import { Bpm } from "../ui/bpm";
import { Labeled, Option } from "../ui/option";
import { FieldGroup } from "../ui/disclosure";
import { Drawer } from "../ui/drawer";
import { SegmentedControl } from "../ui/segmentedControl";
import { BumpValue } from "../ui/stepper";
import { Switch } from "../ui/switch";

const noteHintLabel: Record<NoteHints, string> = {
    always: m.note_hints_always(),
    miss: m.note_hints_miss(),
    never: m.note_hints_never(),
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
    loopAvailable,
    loopOn,
    onToggleLoop,
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
    metronomeOn: boolean;
    setMetronomeOn: (value: boolean) => void;
    adaptive: boolean;
    setAdaptive: (value: boolean) => void;
    liveTempo: number;
    subdivision: number;
    setSubdivision: (value: number) => void;
    forgiving: boolean;
    setForgiving: (value: boolean) => void;
    noteHints: NoteHints;
    setNoteHints: (value: NoteHints) => void;
    raceGhost: boolean;
    setRaceGhost: (value: boolean) => void;
    // The score is loaded and has more than one bar, so a loop range is meaningful.
    loopAvailable: boolean;
    loopOn: boolean;
    onToggleLoop: (next: boolean) => void;
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
                {loopAvailable && (
                    <Option caption={m.loop_caption()}>
                        <Switch checked={loopOn} onChange={onToggleLoop} label={m.loop_section()} />
                    </Option>
                )}
            </FieldGroup>

            {/* Skip the whole group when it would be empty — a locked challenge has no
                transpose, and most pieces have no saved fingering, so the heading would
                otherwise stand alone. */}
            {showMineAvailable && (
                <FieldGroup label={`🎼 ${m.group_notation()}`}>
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
