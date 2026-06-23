// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { Meta, StoryObj } from "@storybook/react-vite";
import type { Exercise } from "../lib/exercises";
import { LoopTrainer } from "./loopTrainer";

const sample: Exercise = {
    id: "sample-scale",
    title: "C major scale",
    description: "One octave, all white keys.",
    abc: "X:1\nT:C major scale\nM:4/4\nL:1/4\nK:C\nC D E F | G A B c |",
    tempo: 90,
    beatsPerBar: 4,
};

const meta: Meta<typeof LoopTrainer> = {
    title: "Trainers/Loop",
    component: LoopTrainer,
    args: { exercise: sample },
};
export default meta;

export const Default: StoryObj<typeof LoopTrainer> = {};
