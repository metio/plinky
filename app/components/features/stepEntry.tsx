// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { STEP_VALUES, type StepValue } from "../../../core/stepInput";
import { m } from "../../paraglide/messages.js";
import { Button } from "../ui/button";
import { ChoiceField, SwitchField } from "../ui/fields";

// Writing a piece down a note at a time, for somebody who knows the tune and cannot play
// it up to speed.
//
// Compose otherwise records a performance, which is the honest thing to do with an
// improvisation and the wrong thing for a piece the player is composing rather than
// playing: their rhythm comes out as whatever their hands managed. With this on, the keys
// name pitches and this panel says how long each one lasts.
//
// The same keys do both jobs, so there is nothing new to learn about playing — only the
// value to pick, a rest, and a way back. Keys pressed together make a chord, and the
// position moves on when the last of them is released.
export function StepEntry({
    on,
    onOn,
    value,
    onValue,
    dotted,
    onDotted,
    onRest,
    onBack,
    canGoBack,
}: {
    on: boolean;
    onOn: (on: boolean) => void;
    value: StepValue;
    onValue: (value: StepValue) => void;
    dotted: boolean;
    onDotted: (dotted: boolean) => void;
    onRest: () => void;
    onBack: () => void;
    canGoBack: boolean;
}) {
    const label: Record<StepValue, string> = {
        whole: m.step_value_whole(),
        half: m.step_value_half(),
        quarter: m.step_value_quarter(),
        eighth: m.step_value_eighth(),
        sixteenth: m.step_value_sixteenth(),
    };
    return (
        <section className="space-y-3">
            <SwitchField
                label={m.step_entry()}
                help={m.step_entry_caption()}
                checked={on}
                onChange={onOn}
            />
            {on && (
                <div className="space-y-3 rounded-md border border-accent-line bg-accent-surface p-3">
                    <ChoiceField
                        label={m.step_value()}
                        value={value}
                        onChange={onValue}
                        options={STEP_VALUES.map((one) => ({ id: one, label: label[one] }))}
                    />
                    <SwitchField
                        label={m.step_dotted()}
                        help={m.step_dotted_caption()}
                        checked={dotted}
                        onChange={onDotted}
                    />
                    <div className="flex flex-wrap gap-2">
                        <Button variant="secondary" onClick={onRest}>
                            {m.step_rest()}
                        </Button>
                        <Button variant="secondary" onClick={onBack} disabled={!canGoBack}>
                            {m.step_back()}
                        </Button>
                    </div>
                </div>
            )}
        </section>
    );
}
