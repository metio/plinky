// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { Meta, StoryObj } from "@storybook/react-vite";
import { INTERVAL_LEVELS } from "../../../core/earExercise";
import { EarLadder } from "./earLadder";

const meta: Meta<typeof EarLadder> = { title: "Features/EarLadder", component: EarLadder };
export default meta;
type Story = StoryObj<typeof EarLadder>;

// The easiest round: three rungs with real air between them, which is what makes the
// fifth and the octave tellable apart before anything else.
export const Easiest: Story = {
    args: {
        choices: INTERVAL_LEVELS[0]!,
        answer: null,
        given: null,
        onChoose: () => {},
    },
};

// Every interval at once — the same ladder with the gaps filled in. Difficulty here is
// something you can see: the rungs crowd.
export const Everything: Story = {
    args: {
        choices: INTERVAL_LEVELS[3]!,
        answer: null,
        given: null,
        onChoose: () => {},
    },
};

export const RightAnswer: Story = {
    args: {
        choices: INTERVAL_LEVELS[1]!,
        answer: "perfect-fifth",
        given: "perfect-fifth",
        onChoose: () => {},
    },
};

// A miss lights both the pick and the truth, and dims everything else, so the distance
// between what was heard and what played is the only thing left to look at.
export const Missed: Story = {
    args: {
        choices: INTERVAL_LEVELS[1]!,
        answer: "perfect-fifth",
        given: "perfect-fourth",
        onChoose: () => {},
    },
};
