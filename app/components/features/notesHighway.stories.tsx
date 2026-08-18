// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { Meta, StoryObj } from "@storybook/react-vite";
import type { UpcomingStep } from "../../../core/matcher";
import { NotesHighway } from "./notesHighway";

const meta: Meta<typeof NotesHighway> = {
    title: "Features/NotesHighway",
    component: NotesHighway,
    args: { from: 60, to: 84 },
    // The highway fills its container's height; the play surface gives it the staff's
    // slot, so the story stands it in a tall box.
    decorators: [
        (Story) => (
            <div className="h-80">
                <Story />
            </div>
        ),
    ],
};
export default meta;

type Story = StoryObj<typeof NotesHighway>;

// Note values counted at 120, which is what every millisecond in these fixtures is.
const WHOLE = 2000;
const HALF = 1000;
const QUARTER = 500;
const EIGHTH = 250;

type Note = { pitch: number; hand: "left" | "right"; ms: number };

const right = (pitch: number, ms: number): Note => ({ pitch, hand: "right", ms });
const left = (pitch: number, ms: number): Note => ({ pitch, hand: "left", ms });

const step = (index: number, atMs: number, notes: Note[]): UpcomingStep => ({
    index,
    atMs,
    pitches: notes.map((note) => note.pitch),
    pitchHands: notes.map((note) => note.hand),
    pitchStaves: notes.map((note) => (note.hand === "left" ? 1 : 0)),
    staves: [...new Set(notes.map((note) => (note.hand === "left" ? 1 : 0)))],
    pitchHoldsMs: notes.map((note) => note.ms),
});

// A run of crotchets climbing away from the keys, the imminent one solid at the floor.
// Even blocks, evenly spaced, because the music is even — which is what makes the
// uneven cases below mean something.
export const RightHand: Story = {
    args: {
        upcoming: [
            step(0, 0, [right(60, QUARTER)]),
            step(1, 500, [right(64, QUARTER)]),
            step(2, 1000, [right(67, QUARTER)]),
            step(3, 1500, [right(72, QUARTER)]),
            step(4, 2000, [right(71, QUARTER)]),
        ],
    },
};

// The case the picture exists for: a semibreve held in the left hand while the right
// plays quavers over it. The long block stands the whole height of the four notes above
// it, which is the only way to see that the hand stays down.
export const HeldUnderARun: Story = {
    args: {
        from: 48,
        to: 84,
        upcoming: [
            step(0, 0, [left(48, WHOLE), right(72, EIGHTH)]),
            step(1, 250, [right(74, EIGHTH)]),
            step(2, 500, [right(76, EIGHTH)]),
            step(3, 750, [right(77, EIGHTH)]),
            step(4, 1000, [right(79, EIGHTH)]),
            step(5, 1250, [right(77, EIGHTH)]),
            step(6, 1500, [right(76, EIGHTH)]),
            step(7, 1750, [right(74, EIGHTH)]),
            step(8, 2000, [left(55, HALF), right(72, HALF)]),
        ],
    },
};

// The values as a ladder, longest to shortest, so the scale reads at a glance: each
// block is half the one before it because each note is.
export const NoteValues: Story = {
    args: {
        upcoming: [
            step(0, 0, [right(60, WHOLE)]),
            step(1, 2000, [right(64, HALF)]),
            step(2, 3000, [right(67, QUARTER)]),
            step(3, 3500, [right(72, EIGHTH)]),
        ],
    },
};

// Two hands, coloured apart: left-hand notes teal, right-hand indigo. The range spans
// both hands so the low left-hand notes have a lane to sit in.
export const TwoHands: Story = {
    args: {
        from: 48,
        to: 84,
        upcoming: [
            step(0, 0, [left(48, QUARTER)]),
            step(1, 500, [right(72, QUARTER)]),
            step(2, 1000, [left(52, QUARTER)]),
            step(3, 1500, [right(76, QUARTER)]),
        ],
    },
};

// A chord stacks several lanes at the same height.
export const Chord: Story = {
    args: {
        upcoming: [
            step(0, 0, [right(60, HALF), right(64, HALF), right(67, HALF)]),
            step(1, 1000, [right(62, HALF), right(65, HALF), right(69, HALF)]),
        ],
    },
};

// A chord the two hands play together, which is 41% of the positions in the real
// catalogue. Each note takes the colour of the hand that plays it — the bass notes
// left, the treble right — rather than the whole chord taking one hand's colour
// because the position happens to involve both. The bass is written longer than the
// treble, which is the other thing a per-note length carries.
export const HandsTogether: Story = {
    args: {
        // Wide enough to hold both hands: the default range starts at middle C, which
        // would drop every bass note out of the picture.
        from: 36,
        to: 84,
        upcoming: [
            step(0, 0, [left(48, HALF), left(55, HALF), right(64, QUARTER), right(67, QUARTER)]),
            step(1, 1000, [left(50, HALF), left(57, HALF), right(65, QUARTER), right(69, QUARTER)]),
        ],
    },
};
