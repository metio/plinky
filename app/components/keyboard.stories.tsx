// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { Meta, StoryObj } from "@storybook/react-vite";
import { Keyboard } from "./keyboard";

const meta: Meta<typeof Keyboard> = {
    title: "Components/Keyboard",
    component: Keyboard,
    args: { from: 60, to: 84 },
};
export default meta;

type Story = StoryObj<typeof Keyboard>;

export const Default: Story = {};

export const Hero: Story = {
    args: { from: 60, to: 72, rise: true, well: "mx-auto w-full max-w-md" },
};

export const ExpectedNote: Story = {
    args: { expected: [64] },
};

export const HeldKeys: Story = {
    args: { lit: new Set([60, 64, 67]) },
};

export const WrongFlash: Story = {
    args: { wrong: { note: 62, seq: 1 } },
};
