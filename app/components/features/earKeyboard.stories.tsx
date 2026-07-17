// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { Meta, StoryObj } from "@storybook/react-vite";
import type { NoteNameId } from "../../../core/theory";
import { EarKeyboard } from "./earKeyboard";

const meta: Meta<typeof EarKeyboard> = { title: "Features/EarKeyboard", component: EarKeyboard };
export default meta;
type Story = StoryObj<typeof EarKeyboard>;

const NATURALS: NoteNameId[] = ["c", "d", "e", "f", "g", "a", "b"];
const ALL: NoteNameId[] = [
    "c",
    "c-sharp",
    "d",
    "d-sharp",
    "e",
    "f",
    "f-sharp",
    "g",
    "g-sharp",
    "a",
    "a-sharp",
    "b",
];

// The white keys on their own — the round a beginner starts on.
export const Naturals: Story = {
    args: { choices: NATURALS, answer: null, given: null, onChoose: () => {} },
};

export const EveryNote: Story = {
    args: { choices: ALL, answer: null, given: null, onChoose: () => {} },
};

export const RightAnswer: Story = {
    args: { choices: NATURALS, answer: "g", given: "g", onChoose: () => {} },
};

// A miss on a black key: the pick and the answer both stay lit against the dimmed rest.
export const Missed: Story = {
    args: { choices: ALL, answer: "f-sharp", given: "g", onChoose: () => {} },
};
