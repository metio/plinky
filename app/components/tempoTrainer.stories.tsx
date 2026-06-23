// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { Meta, StoryObj } from "@storybook/react-vite";
import { exercises } from "../lib/exercises";
import { TempoTrainer } from "./tempoTrainer";

const meta: Meta<typeof TempoTrainer> = {
    title: "Trainers/Tempo",
    component: TempoTrainer,
    args: { exercise: exercises[0] },
};
export default meta;

export const Default: StoryObj<typeof TempoTrainer> = {};
