// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { Meta, StoryObj } from "@storybook/react-vite";
import type { RunNote } from "../../../core/shareCard";
import { PerformanceStrip } from "./performanceStrip";

const meta: Meta<typeof PerformanceStrip> = {
    title: "UI/PerformanceStrip",
    component: PerformanceStrip,
};
export default meta;

type Story = StoryObj<typeof PerformanceStrip>;

// Targets 500ms apart; playedMs offsets pick the timing band per note.
const note = (index: number, offsetMs: number, wrongBefore = 0): RunNote => ({
    targetMs: index * 500,
    playedMs: index * 500 + offsetMs,
    wrongBefore,
});

export const CleanRun: Story = {
    args: {
        notes: [
            note(0, 0),
            note(1, 10),
            note(2, -15),
            note(3, 5),
            note(4, -8),
            note(5, 12),
            note(6, 0),
            note(7, -5),
        ],
    },
};

// Wide misses, a wrong key (red ring), and a long pause (dashed hesitation line).
export const RoughRun: Story = {
    args: {
        notes: [
            note(0, 0),
            note(1, 90),
            note(2, -160),
            note(3, 40, 2),
            note(4, 220),
            { targetMs: 2500, playedMs: 4500, wrongBefore: 0 },
            note(6, -60),
            note(7, 130, 1),
        ],
    },
};
