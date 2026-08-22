// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { Meta, StoryObj } from "@storybook/react-vite";
import { ChoiceField, SwitchField } from "./fields";

const meta: Meta<typeof ChoiceField> = { title: "UI/Fields", component: ChoiceField };
export default meta;

type Story = StoryObj<typeof ChoiceField>;

const HANDS = [
    { id: "both", label: "Both hands" },
    { id: "left", label: "Left" },
    { id: "right", label: "Right" },
];

// Every option visible and tappable — no dropdown to open, nothing hidden — with
// the help line that explains the pick in plain words.
export const Choice: Story = {
    render: () => (
        <div className="flex flex-col gap-6">
            <ChoiceField
                label="Which hands"
                value="both"
                onChange={() => {}}
                options={HANDS}
                help="Both hands together, or one at a time while you learn the other."
            />
            <ChoiceField label="Which hands" value="right" onChange={() => {}} options={HANDS} />
        </div>
    ),
};

// A boolean preference, with and without its help line, and the disabled state a
// setting takes when something else has to be on first.
export const Switches: Story = {
    render: () => (
        <div className="flex flex-col gap-6">
            <SwitchField
                label="Play sounds"
                checked={true}
                onChange={() => {}}
                help="Hear the piano as you play. Turn this off to practise silently."
            />
            <SwitchField label="Show finger numbers" checked={false} onChange={() => {}} />
            <SwitchField
                label="Count me in"
                checked={false}
                onChange={() => {}}
                help="Unavailable while you are entering notes one at a time."
                disabled
            />
        </div>
    ),
};

// Both fields disabled together, which is how a whole group reads when the panel
// above it is switched off.
export const Disabled: Story = {
    render: () => (
        <div className="flex flex-col gap-6">
            <ChoiceField
                label="Which hands"
                value="left"
                onChange={() => {}}
                options={HANDS}
                disabled
            />
            <SwitchField label="Play sounds" checked={true} onChange={() => {}} disabled />
        </div>
    ),
};
