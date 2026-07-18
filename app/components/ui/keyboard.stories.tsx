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

// The hold-duration fill mid-shrink: a note struck a moment ago (tall fill) and one
// nearly released (short fill), on a white key and a black key, so the "keep holding"
// cue is captured in both shapes.
export const HoldDuration: Story = {
    args: {
        lit: new Set([60]),
        holds: new Map([
            [60, 0.75],
            [66, 0.25],
        ]),
    },
};
