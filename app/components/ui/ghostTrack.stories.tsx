// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { Meta, StoryObj } from "@storybook/react-vite";
import { GhostTrack } from "./ghostTrack";

const meta: Meta<typeof GhostTrack> = {
    title: "UI/GhostTrack",
    component: GhostTrack,
    decorators: [
        (Story) => (
            <div className="w-80 p-4">
                <Story />
            </div>
        ),
    ],
};
export default meta;

type Story = StoryObj<typeof GhostTrack>;

export const Ahead: Story = {
    args: { you: 24, ghost: 16, total: 40 },
};

export const Behind: Story = {
    args: { you: 10, ghost: 22, total: 40 },
};

export const Tied: Story = {
    args: { you: 20, ghost: 20, total: 40 },
};

export const CommandingLead: Story = {
    args: { you: 34, ghost: 9, total: 40 },
};

export const PhotoFinish: Story = {
    args: { you: 38, ghost: 37, total: 40 },
};
