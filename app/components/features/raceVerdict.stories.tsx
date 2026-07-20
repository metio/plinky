// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { Meta, StoryObj } from "@storybook/react-vite";
import { RaceVerdict } from "./raceVerdict";

const meta: Meta<typeof RaceVerdict> = {
    title: "Features/RaceVerdict",
    component: RaceVerdict,
    decorators: [
        (Story) => (
            <div className="w-80 p-4">
                <Story />
            </div>
        ),
    ],
};
export default meta;

type Story = StoryObj<typeof RaceVerdict>;

export const Won: Story = {
    args: { verdict: { outcome: "won", marginMs: 2340 } },
};

export const Lost: Story = {
    args: { verdict: { outcome: "lost", marginMs: 1100 } },
};

export const DeadHeat: Story = {
    args: { verdict: { outcome: "tie", marginMs: 40 } },
};
