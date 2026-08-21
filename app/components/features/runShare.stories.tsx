// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { Meta, StoryObj } from "@storybook/react-vite";
import type { Grid, RunNote } from "../../../core/shareCard";
import { RunShare } from "./runShare";

const meta: Meta<typeof RunShare> = {
    title: "Features/RunShare",
    component: RunShare,
    args: { letter: "B", title: "Gymnopédie No. 1", daily: null },
};
export default meta;

type Story = StoryObj<typeof RunShare>;

// A run's notes only decide how many rows the labels name; the grid itself is passed in.
const oneHand: RunNote[] = [{ targetMs: 0, playedMs: 0, wrongBefore: 0, staves: [0] }];
const twoHands: RunNote[] = [{ targetMs: 0, playedMs: 0, wrongBefore: 0, staves: [0, 1] }];

// A single-staff piece has no hands to tell apart, so its one row is just "you".
export const OneRow: Story = {
    args: {
        notes: oneHand,
        grid: [["best", "best", "good", "best", "good", "best"]] as Grid,
    },
};

// A grand staff gets a row per hand, LEFT first — the grid reads like a keyboard rather
// than like the printed page, where the right hand sits on top.
export const BothHands: Story = {
    args: {
        notes: twoHands,
        grid: [
            ["ok", "weak", "ok", "weak", "weak", "none"],
            ["best", "good", "good", "best", "good", "good"],
        ] as Grid,
    },
};

// The daily challenge boasts its number instead of the piece's name.
export const Daily: Story = {
    args: {
        notes: oneHand,
        daily: 128,
        grid: [["best", "best", "best", "best", "best", "best"]] as Grid,
    },
};
