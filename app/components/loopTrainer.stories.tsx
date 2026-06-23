// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { Meta, StoryObj } from "@storybook/react-vite";
import { exercises } from "../lib/exercises";
import { LoopTrainer } from "./loopTrainer";

const meta: Meta<typeof LoopTrainer> = {
    title: "Trainers/Loop",
    component: LoopTrainer,
    args: { exercise: exercises[0] },
};
export default meta;

export const Default: StoryObj<typeof LoopTrainer> = {};
