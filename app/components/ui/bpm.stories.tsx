// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { Meta, StoryObj } from "@storybook/react-vite";
import { Bpm } from "./bpm";

const meta: Meta<typeof Bpm> = {
    title: "UI/Bpm",
    component: Bpm,
};
export default meta;

type Story = StoryObj<typeof Bpm>;

export const Default: Story = {
    args: { tempo: 96 },
};

export const InlineWithText: Story = {
    render: () => (
        <p className="text-sm text-gray-700 dark:text-gray-300">
            Practice tempo: <Bpm tempo={120} className="font-medium" />
        </p>
    ),
};
