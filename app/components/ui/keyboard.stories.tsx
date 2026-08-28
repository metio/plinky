// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, waitFor } from "storybook/test";
import { GLOSSY, JOYFUL } from "../../../core/keyboardFinish";
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

// What Listen lights while it demonstrates a piece: the notes sounding at this instant,
// each in its own hand's colour — the same teal and indigo the notes highway uses. Both a
// white key and a black one, because they are painted by different rules: a sounding black
// key is filled, where an expected one is only ringed.
export const SoundingByHand: Story = {
    // A two-octave span so both hands fit: the default story keyboard starts at middle C,
    // where a left hand has nowhere to be.
    args: {
        from: 48,
        to: 84,
        sounding: new Map<number, "left" | "right">([
            [48, "left"],
            [55, "left"],
            [58, "left"],
            [72, "right"],
            [76, "right"],
            [78, "right"],
        ]),
    },
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

// The two finishes side by side in the same skin, because the difference between them is
// the whole point of the setting and neither is described anywhere a screenshot can check.

// The default: flat, bright, friendly. What somebody who has never played sees first.
export const FinishJoyful: Story = {
    args: { from: 60, to: 72, finish: JOYFUL },
};

// The instrument as a photograph of one — a lip across the front, light down the key. What
// a video is rendered in, and what a player can now ask for on the page too.
export const FinishGlossy: Story = {
    args: { from: 60, to: 72, finish: GLOSSY },
};

// Glossy with keys lit, since the shading has to stay legible under a state colour rather
// than fighting it.
export const FinishGlossyLit: Story = {
    args: { from: 60, to: 72, finish: GLOSSY, lit: new Set([60, 64, 67]) },
};
