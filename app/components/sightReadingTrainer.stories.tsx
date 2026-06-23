// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { Meta, StoryObj } from "@storybook/react-vite";
import type { Exercise } from "../lib/exercises";
import { SightReadingTrainer } from "./sightReadingTrainer";

const scale: Exercise = {
    id: "sample-scale",
    title: "C major scale",
    description: "One octave, all white keys.",
    abc: "X:1\nT:C major scale\nM:4/4\nL:1/4\nK:C\nC D E F | G A B c |",
    tempo: 90,
    beatsPerBar: 4,
};

const twoHands: Exercise = {
    id: "sample-two-hands",
    title: "Two-hand C major",
    description: "A right-hand melody over a left-hand bass.",
    abc: "X:1\nT:Two-hand C major\nM:4/4\nL:1/4\nV:1 clef=treble\nV:2 clef=bass\nV:1\nK:C\nc d e f | g f e d |\nV:2\nC2 G2 | C2 G2 |",
    tempo: 80,
    beatsPerBar: 4,
};

const meta: Meta<typeof SightReadingTrainer> = {
    title: "Trainers/Practice",
    component: SightReadingTrainer,
    args: { exercise: scale },
};
export default meta;

type Story = StoryObj<typeof SightReadingTrainer>;

export const Scale: Story = {};
export const TwoHands: Story = { args: { exercise: twoHands } };
