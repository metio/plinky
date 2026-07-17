// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { Meta, StoryObj } from "@storybook/react-vite";
import type { ChordQuality } from "../../../core/theory";
import { chordName } from "../../lib/theoryNames";
import { EarChoices } from "./earChoices";

const meta: Meta<typeof EarChoices<ChordQuality>> = {
    title: "Features/EarChoices",
    component: EarChoices,
};
export default meta;
type Story = StoryObj<typeof EarChoices<ChordQuality>>;

const TRIADS: ChordQuality[] = ["major", "minor", "diminished", "augmented"];

// The live grid: every choice offered, nothing revealed yet.
export const Live: Story = {
    args: {
        choices: TRIADS,
        answer: null,
        given: null,
        onChoose: () => {},
        nameOf: chordName,
        label: "Chord choices",
    },
};

export const RightAnswer: Story = {
    args: {
        choices: TRIADS,
        answer: "minor",
        given: "minor",
        onChoose: () => {},
        nameOf: chordName,
        label: "Chord choices",
    },
};

// A miss lights both the pick and the truth, and dims the rest.
export const Missed: Story = {
    args: {
        choices: TRIADS,
        answer: "diminished",
        given: "minor",
        onChoose: () => {},
        nameOf: chordName,
        label: "Chord choices",
    },
};
