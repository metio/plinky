// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { Meta, StoryObj } from "@storybook/react-vite";
import { GradeBadgeView } from "./gradeBadge";

// The badge from plain values, so each standing it can show is a frame of its own —
// what the header carries is decided by the container, which shows nothing at all until
// there is something to report.
const meta: Meta<typeof GradeBadgeView> = {
    title: "Features/GradeBadge",
    component: GradeBadgeView,
};
export default meta;

type Story = StoryObj<typeof GradeBadgeView>;

// The first thing to master lifts the skill rating long before it lifts the grade, so
// the cap stays grey while the number beside it is real.
export const Starting: Story = {
    args: { level: 0, skill: 12, competitive: false },
};

export const Earned: Story = {
    args: { level: 3, skill: 214, competitive: false },
};

export const CompetitiveMode: Story = {
    args: { level: 3, skill: 189, competitive: true },
};
