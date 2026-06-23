// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { Meta, StoryObj } from "@storybook/react-vite";
import { exercises } from "../lib/exercises";
import { RhythmTrainer } from "./rhythmTrainer";

const meta: Meta<typeof RhythmTrainer> = {
    title: "Trainers/Rhythm",
    component: RhythmTrainer,
    args: { exercise: exercises[0] },
};
export default meta;

export const Default: StoryObj<typeof RhythmTrainer> = {};
