// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { Meta, StoryObj } from "@storybook/react-vite";
import { buildSnippet } from "../../../core/glossaryScore";
import { ScoreSymbols } from "./scoreSymbols";

// What a reader sees in the run-setup panel before playing: the marks this piece will
// ask them to read, each one a way into the glossary.
const meta: Meta<typeof ScoreSymbols> = {
    title: "Features/ScoreSymbols",
    // The preview already provides a router, which the glossary links need.
    component: ScoreSymbols,
};
export default meta;

type Story = StoryObj<typeof ScoreSymbols>;

export const SeveralMarks: Story = {
    args: {
        xml: buildSnippet({
            clef: "bass",
            fifths: 2,
            beatsPerBar: 3,
            notes: [
                { step: "C", octave: 3, value: "quarter", articulation: "staccato", dynamic: "p" },
                { step: null, value: "quarter" },
                { step: "G", octave: 2, value: "quarter", tie: "start" },
                { step: "G", octave: 2, value: "half", dotted: true, tie: "stop" },
            ],
        }),
    },
};
