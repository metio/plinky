// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, waitFor } from "storybook/test";
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

// A miss leaves the keyboard as it was. The red cue itself clears on a 450 ms timer
// the component owns, so a screenshot either races it or catches it mid-fade and never
// settles — the play function waits it out, and the colour is asserted in
// keyboard.test.tsx where a jsdom render can hold it still.
export const WrongFlash: Story = {
    args: { wrong: { note: 62, seq: 1 } },
    play: async ({ canvasElement }) => {
        await waitFor(() => expect(canvasElement.querySelector(".bg-danger-fill")).toBeNull(), {
            timeout: 2000,
        });
    },
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

// The keybed named the way a reader raised on do-re-mi already thinks of it —
// every key, with the black keys reading as the syllable below them raised.
export const SolfegeLabels: Story = {
    args: { labels: "solfege" },
};
