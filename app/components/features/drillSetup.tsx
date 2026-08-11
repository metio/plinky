// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { DrillOptions } from "../../../core/drill";
import { clampDrill, DRILL_FIELDS, type DrillField, keyName } from "../../../core/drillSpec";
import { m } from "../../paraglide/messages.js";
import { ChoiceField, SwitchField } from "../ui/fields";
import { SlidersIcon } from "../ui/icons";
import { SettingsSection } from "../ui/settingsSection";
import { Stepper } from "../ui/stepper";

// What each field is called, and how its value reads. Kept beside the spec it
// renders rather than inside core/, which holds no user-facing prose — so adding a
// knob is one entry in DRILL_FIELDS and one here, and the two lists are checked
// against each other by the panel's own test.
const LABEL: Record<DrillField["id"], () => string> = {
    bars: m.drill_bars,
    fifths: m.drill_key,
    chromatic: m.drill_chromatic,
    range: m.drill_range,
    hands: m.drill_hands,
    notesPerColumn: m.drill_notes,
    rhythm: m.drill_rhythm,
    maxLeap: m.drill_leap,
    smoothness: m.drill_smoothness,
};

const HELP: Partial<Record<DrillField["id"], () => string>> = {
    chromatic: m.drill_chromatic_help,
    notesPerColumn: m.drill_notes_help,
    maxLeap: m.drill_leap_help,
    smoothness: m.drill_smoothness_help,
};

const RHYTHM_LABEL: Record<string, () => string> = {
    quarters: m.drill_rhythm_quarters,
    eighths: m.drill_rhythm_eighths,
    varied: m.drill_rhythm_varied,
};

// Middle C is MIDI 60, and the octave numbering names it C4.
const LETTERS = ["C", "C♯", "D", "E♭", "E", "F", "F♯", "G", "A♭", "A", "B♭", "B"];

export function noteName(midi: number): string {
    return `${LETTERS[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`;
}

// How a numeric field's current value reads: most are plain counts, but a key is a
// key's name, and a leap of nothing is no limit at all.
function readNumber(id: DrillField["id"], value: number): string {
    if (id === "fifths") {
        return keyName(value);
    }
    if (id === "maxLeap") {
        return value === 0 ? m.drill_leap_free() : m.drill_leap_semitones({ count: value });
    }
    return String(value);
}

// The drill's shape, one control per option in DRILL_FIELDS. Every change hands
// back a clamped drill, so a value the generator could not use never leaves here.
export function DrillSetup({
    value,
    onChange,
}: {
    value: DrillOptions;
    onChange: (next: DrillOptions) => void;
}) {
    const update = (patch: Partial<DrillOptions>) => onChange(clampDrill({ ...value, ...patch }));

    return (
        <SettingsSection
            title={m.drill_setup()}
            hint={m.drill_setup_hint()}
            icon={<SlidersIcon className="h-5 w-5" />}
        >
            {DRILL_FIELDS.map((field) => {
                const label = LABEL[field.id]();
                const help = HELP[field.id]?.();

                if (field.kind === "switch") {
                    return (
                        <SwitchField
                            key={field.id}
                            label={label}
                            checked={value.chromatic}
                            onChange={(chromatic) => update({ chromatic })}
                            help={help}
                        />
                    );
                }

                if (field.kind === "choice") {
                    const current = field.id === "hands" ? String(value.hands) : value.rhythm;
                    return (
                        <ChoiceField
                            key={field.id}
                            label={label}
                            value={current}
                            onChange={(next: string) =>
                                update(
                                    field.id === "hands"
                                        ? { hands: next === "2" ? 2 : 1 }
                                        : { rhythm: next as DrillOptions["rhythm"] },
                                )
                            }
                            options={field.options.map((option) => ({
                                id: option,
                                label:
                                    field.id === "hands"
                                        ? option === "2"
                                            ? m.drill_hands_two()
                                            : m.drill_hands_one()
                                        : (RHYTHM_LABEL[option]?.() ?? option),
                            }))}
                            help={help}
                        />
                    );
                }

                if (field.kind === "range") {
                    // Two ends of one span: each is bounded by the other, so the range
                    // cannot be dragged inside out.
                    return (
                        <div key={field.id} className="space-y-1">
                            <span className="block text-sm font-medium text-body">{label}</span>
                            <div className="flex flex-wrap items-center gap-4">
                                <Stepper
                                    value={noteName(value.low)}
                                    decrementLabel={m.drill_range_lower_down()}
                                    incrementLabel={m.drill_range_lower_up()}
                                    canDecrement={value.low > field.min}
                                    canIncrement={value.low < value.high}
                                    onDecrement={() => update({ low: value.low - 1 })}
                                    onIncrement={() => update({ low: value.low + 1 })}
                                />
                                <Stepper
                                    value={noteName(value.high)}
                                    decrementLabel={m.drill_range_upper_down()}
                                    incrementLabel={m.drill_range_upper_up()}
                                    canDecrement={value.high > value.low}
                                    canIncrement={value.high < field.max}
                                    onDecrement={() => update({ high: value.high - 1 })}
                                    onIncrement={() => update({ high: value.high + 1 })}
                                />
                            </div>
                        </div>
                    );
                }

                const current = value[field.id];
                return (
                    <div key={field.id} className="space-y-1">
                        <span className="block text-sm font-medium text-body">{label}</span>
                        <Stepper
                            value={readNumber(field.id, current)}
                            decrementLabel={m.drill_less({ field: label })}
                            incrementLabel={m.drill_more({ field: label })}
                            canDecrement={current > field.min}
                            canIncrement={current < field.max}
                            onDecrement={() => update({ [field.id]: current - 1 })}
                            onIncrement={() => update({ [field.id]: current + 1 })}
                        />
                        {help && <p className="text-xs text-muted">{help}</p>}
                    </div>
                );
            })}
        </SettingsSection>
    );
}
