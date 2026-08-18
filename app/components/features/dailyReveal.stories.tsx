// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { Meta, StoryObj } from "@storybook/react-vite";
import { DailyReveal } from "./dailyReveal";

const meta: Meta<typeof DailyReveal> = { title: "Features/DailyReveal", component: DailyReveal };
export default meta;

type Story = StoryObj<typeof DailyReveal>;

const Result = () => (
    <div className="rounded-md border border-line p-4">
        <p className="text-sm text-muted">Today's phrase</p>
        <p className="text-lg font-medium">Four bars in C, right hand.</p>
    </div>
);

// The unopened present: one inviting button, the day's phrase behind it.
export const Present: Story = {
    render: () => (
        <DailyReveal alreadyOpen={false}>
            <Result />
        </DailyReveal>
    ),
};

// A daily already finished shows its result straight away — the ceremony belongs
// to the first visit only.
export const Opened: Story = {
    render: () => (
        <DailyReveal alreadyOpen={true}>
            <Result />
        </DailyReveal>
    ),
};
