// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { Meta, StoryObj } from "@storybook/react-vite";
import { WarmUpWays } from "./warmUpWays";

// The four ways to start, which is the first thing on the front page and the one block
// most likely to be met on a phone. The stories are what hold its shape: the failure this
// replaced was a row that looked fine at a desktop width and fell apart at 390px.
const meta: Meta<typeof WarmUpWays> = {
    title: "Features/WarmUpWays",
    component: WarmUpWays,
    args: { arcadeTo: "/play/exercise", arcadeKey: "F♯" },
};
export default meta;

type Story = StoryObj<typeof WarmUpWays>;

// The ordinary morning: the challenge is there and unopened, so it leads.
export const Waiting: Story = {
    args: { daily: { to: "/daily", label: "Today's challenge", done: false } },
};

// Done for the day. It stays where it is — the ✓ belongs to the row that reports it, and a
// warm-up that moved once you had done it would be a page that rearranged itself under
// somebody's hands.
export const Done: Story = {
    args: { daily: { to: "/daily", label: "Today's challenge ✓", done: true } },
};

// Before the day's tasks have been worked out. The three that need nothing to be decided
// stand on their own rather than leaving a hole where the lead will be.
export const NoDaily: Story = {};
