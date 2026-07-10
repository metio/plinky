// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { Meta, StoryObj } from "@storybook/react-vite";
import { MilestoneBanner } from "./milestoneBanner";

// One story per milestone kind — each composes a different heading, card and
// boast from the same banner shell.
const meta: Meta<typeof MilestoneBanner> = {
    title: "Features/MilestoneBanner",
    component: MilestoneBanner,
};
export default meta;

type Story = StoryObj<typeof MilestoneBanner>;

export const GradeUp: Story = {
    args: {
        milestone: { kind: "grade-up", grade: 3, skill: 42 },
        onDismiss: () => {},
    },
};

export const FirstS: Story = {
    args: {
        milestone: { kind: "first-s", songTitle: "Ode to Joy" },
        onDismiss: () => {},
    },
};

export const Flawless: Story = {
    args: {
        milestone: { kind: "flawless", songTitle: "Minuet in G" },
        onDismiss: () => {},
    },
};
