// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { Meta, StoryObj } from "@storybook/react-vite";
import { PianoKeyboard } from "./pianoKeyboard";

const meta: Meta<typeof PianoKeyboard> = {
    title: "Components/PianoKeyboard",
    component: PianoKeyboard,
};
export default meta;

type Story = StoryObj<typeof PianoKeyboard>;

export const Default: Story = {};

export const WithExpectedNotes: Story = {
    args: { expected: [60, 64, 67] },
};

export const TwoOctaves: Story = {
    args: { from: 48, to: 84 },
};
