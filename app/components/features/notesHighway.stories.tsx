// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { Meta, StoryObj } from "@storybook/react-vite";
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

// A single-hand run climbing away from the keys, the imminent note solid at the floor.
export const RightHand: Story = {
    args: {
        upcoming: [
            { index: 0, pitches: [60], pitchStaves: [0], staves: [0] },
            { index: 1, pitches: [64], pitchStaves: [0], staves: [0] },
            { index: 2, pitches: [67], pitchStaves: [0], staves: [0] },
            { index: 3, pitches: [72], pitchStaves: [0], staves: [0] },
            { index: 4, pitches: [71], pitchStaves: [0], staves: [0] },
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
            { index: 0, pitches: [48], pitchStaves: [1], staves: [1] },
            { index: 1, pitches: [72], pitchStaves: [0], staves: [0] },
            { index: 2, pitches: [52], pitchStaves: [1], staves: [1] },
            { index: 3, pitches: [76], pitchStaves: [0], staves: [0] },
        ],
    },
};

// A chord stacks several lanes in the same row.
export const Chord: Story = {
    args: {
        upcoming: [
            { index: 0, pitches: [60, 64, 67], pitchStaves: [0, 0, 0], staves: [0] },
            { index: 1, pitches: [62, 65, 69], pitchStaves: [0, 0, 0], staves: [0] },
        ],
    },
};

// A chord the two hands play together, which is 41% of the positions in the real
// catalogue. Each note takes the colour of the hand that plays it — the bass notes
// left, the treble right — rather than the whole chord taking one hand's colour
// because the position happens to involve both.
export const HandsTogether: Story = {
    args: {
        // Wide enough to hold both hands: the default range starts at middle C, which
        // would drop every bass note out of the picture.
        from: 36,
        to: 84,
        upcoming: [
            { index: 0, pitches: [48, 55, 64, 67], pitchStaves: [1, 1, 0, 0], staves: [0, 1] },
            { index: 1, pitches: [50, 57, 65, 69], pitchStaves: [1, 1, 0, 0], staves: [0, 1] },
        ],
    },
};
