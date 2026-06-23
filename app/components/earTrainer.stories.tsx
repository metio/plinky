// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { Meta, StoryObj } from "@storybook/react-vite";
import { EarTrainer } from "./earTrainer";

const meta: Meta<typeof EarTrainer> = {
    title: "Trainers/Ear training",
    component: EarTrainer,
};
export default meta;

export const Default: StoryObj<typeof EarTrainer> = {};
