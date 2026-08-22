// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { Meta, StoryObj } from "@storybook/react-vite";
import { LoopRangeBar } from "./loopRangeBar";

const meta: Meta<typeof LoopRangeBar> = {
    title: "Features/LoopRangeBar",
    component: LoopRangeBar,
    args: {
        measureCount: 32,
        setFrom: () => {},
        setTo: () => {},
        onWholeSong: () => {},
    },
};
export default meta;

type Story = StoryObj<typeof LoopRangeBar>;

// The whole song: nothing to reset to, so the bar spends the space on how to
// narrow instead.
export const WholeSong: Story = { args: { from: 1, to: 32 } };

// A narrowed range, where the hint gives way to the way back out.
export const Narrowed: Story = { args: { from: 9, to: 16 } };

// A single bar, which is the tightest the range goes and the one a hard passage
// ends up at.
export const OneBar: Story = { args: { from: 24, to: 24 } };
