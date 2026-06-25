// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { Meta, StoryObj } from "@storybook/react-vite";
import { SprintTrainer } from "./sprintTrainer";

const meta: Meta<typeof SprintTrainer> = {
    title: "Trainers/Sprint",
    component: SprintTrainer,
};
export default meta;

type Story = StoryObj<typeof SprintTrainer>;

export const Sprint: Story = {};
