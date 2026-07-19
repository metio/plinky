// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { Meta, StoryObj } from "@storybook/react-vite";
import { NotesHighway } from "./notesHighway";

const meta: Meta<typeof NotesHighway> = {
    title: "Features/NotesHighway",
    component: NotesHighway,
    args: { from: 60, to: 84 },
};
export default meta;

type Story = StoryObj<typeof NotesHighway>;

// A single-hand run climbing away from the keys, the imminent note solid at the floor.
export const RightHand: Story = {
    args: {
        upcoming: [
            { index: 0, pitches: [60], staves: [0] },
            { index: 1, pitches: [64], staves: [0] },
            { index: 2, pitches: [67], staves: [0] },
            { index: 3, pitches: [72], staves: [0] },
            { index: 4, pitches: [71], staves: [0] },
        ],
    },
};

// Two hands, coloured apart: left-hand positions teal, right-hand indigo. The
// range spans both hands so the low left-hand notes have a lane to sit in.
export const TwoHands: Story = {
    args: {
        from: 48,
        to: 84,
        upcoming: [
            { index: 0, pitches: [48], staves: [1] },
            { index: 1, pitches: [72], staves: [0] },
            { index: 2, pitches: [52], staves: [1] },
            { index: 3, pitches: [76], staves: [0] },
        ],
    },
};

// A chord stacks several lanes in the same row.
export const Chord: Story = {
    args: {
        upcoming: [
            { index: 0, pitches: [60, 64, 67], staves: [0] },
            { index: 1, pitches: [62, 65, 69], staves: [0] },
        ],
    },
};
