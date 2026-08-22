// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { Meta, StoryObj } from "@storybook/react-vite";
import { GlossaryIndex } from "./glossaryIndex";

const meta: Meta<typeof GlossaryIndex> = {
    title: "Features/GlossaryIndex",
    component: GlossaryIndex,
    decorators: [
        (Story) => (
            <div className="max-w-xs">
                <Story />
            </div>
        ),
    ],
    args: { onSelect: () => {} },
};
export default meta;

type Story = StoryObj<typeof GlossaryIndex>;

// Every symbol grouped by what it controls — how long, how you touch it, how
// loud, where you are. The grouping is the teaching: a reader who met a curved
// line can see that a curve is about touch before opening a single entry.
export const Groups: Story = { args: { selected: "slur" } };

// A selection in the last group, so the highlight is legible against a group
// label rather than only at the top of the list.
export const LaterSelection: Story = { args: { selected: "bassClef" } };
