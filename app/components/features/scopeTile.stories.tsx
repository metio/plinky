// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { Meta, StoryObj } from "@storybook/react-vite";
import { ScopeTile } from "./scopeTile";

// The head of the You page's "How it's going" block. One tile in place of two things that
// used to sit at opposite ends of the page — a lifetime total near the top and a monthly
// recap near the foot — which were the same three figures over two windows.
//
// The clock is pinned: the tile names its own window, and one drawn from the wall clock
// would render a different month every month.
const meta: Meta<typeof ScopeTile> = {
    title: "Features/ScopeTile",
    component: ScopeTile,
    args: {
        now: new Date("2026-08-19T10:00:00"),
        summary: {
            totalNotes: 4820,
            daysPracticed: 18,
            bestDay: { date: "2026-08-12", notes: 640 },
        },
    },
};
export default meta;

type Story = StoryObj<typeof ScopeTile>;

// The dial's resting position, and the window somebody checking in on themselves means.
export const ThisMonth: Story = { args: { scope: "month" } };

// The same three figures, all the way back. What used to be a section of its own near the
// top of the page.
export const AllTime: Story = { args: { scope: "all" } };

// A window with practice in it but no standout day — every day much like the last, which
// is what a good habit looks like.
export const NoStandoutDay: Story = {
    args: { scope: "week", summary: { totalNotes: 940, daysPracticed: 4, bestDay: null } },
};
