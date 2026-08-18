// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { Meta, StoryObj } from "@storybook/react-vite";
import { StepEntry } from "./stepEntry";

// The two states that matter: out of the way, and open. Compose is a place to improvise
// first, so the closed state is the one most players see.
const meta: Meta<typeof StepEntry> = {
    title: "Features/StepEntry",
    component: StepEntry,
    args: {
        on: false,
        value: "quarter",
        dotted: false,
        canGoBack: true,
        onOn: () => {},
        onValue: () => {},
        onDotted: () => {},
        onRest: () => {},
        onBack: () => {},
    },
    decorators: [
        (Story) => (
            <div className="max-w-md">
                <Story />
            </div>
        ),
    ],
};
export default meta;

type Story = StoryObj<typeof StepEntry>;

export const Closed: Story = {};

export const Open: Story = { args: { on: true } };

// A dotted eighth, and nothing yet to take back — the state a take starts in.
export const EmptyTake: Story = {
    args: { on: true, value: "eighth", dotted: true, canGoBack: false },
};
