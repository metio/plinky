// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

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

// The narrowest the drill goes. Three columns used to stretch two answers across two
// thirds of the width with a gap between them the size of a third answer; wrapping keeps
// them together and centred, which is what this story is here to hold.
export const TwoAnswers: Story = {
    args: {
        choices: ["major", "minor"] satisfies ChordQuality[],
        answer: null,
        given: null,
        onChoose: () => {},
        nameOf: chordName,
        label: "Chord choices",
    },
};
