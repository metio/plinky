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
    // A key with no accidental in it, deliberately. The sharp sign is not in the app's own
    // face, so it comes from whatever fallback font the machine has, and the two machines
    // running this suite do not choose the same one — which is a fact about fonts rather
    // than about this component, and it is the only thing that made this story disagree.
    args: { arcadeTo: "/play/exercise", arcadeKey: "C" },
};
export default meta;

type Story = StoryObj<typeof WarmUpWays>;

// The ordinary morning: the challenge is there and unopened, so it leads.
export const Waiting: Story = {
    args: { daily: { to: "/daily", label: "Today's challenge", done: false } },
};

// Done for the day. It stays where it is — the tick belongs to the row that reports it, and a
// warm-up that moved once you had done it would be a page that rearranged itself under
// somebody's hands.
export const Done: Story = {
    // Stand-in text, and deliberately plain: a tick is another glyph the app face does not
    // carry. The real label comes from the day's own row.
    args: { daily: { to: "/daily", label: "Today's challenge, done", done: true } },
};

// Before the day's tasks have been worked out. The three that need nothing to be decided
// stand on their own rather than leaving a hole where the lead will be.
export const NoDaily: Story = {};
