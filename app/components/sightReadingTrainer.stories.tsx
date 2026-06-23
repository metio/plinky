// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { Meta, StoryObj } from "@storybook/react-vite";
import { exercises } from "../lib/exercises";
import { SightReadingTrainer } from "./sightReadingTrainer";

const meta: Meta<typeof SightReadingTrainer> = {
    title: "Trainers/Practice",
    component: SightReadingTrainer,
    args: { exercise: exercises[0] },
};
export default meta;

type Story = StoryObj<typeof SightReadingTrainer>;

export const Scale: Story = {};
export const TwoHands: Story = {
    args: {
        exercise: exercises.find((exercise) => exercise.id === "two-hand-warmup") ?? exercises[0],
    },
};
