// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

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

// Three marks with short glosses, chosen so every row fits comfortably on one line at
// the 800px baseline viewport. The longer glosses run to within ~200px of the edge, and
// a sub-pixel font-metric difference between machines is enough to wrap one of them —
// which reflows every row below it and blows past the 0.5% pixel allowance. Three short
// rows pin the layout, the link styling and the glossary's grouping order just as well.
export const SeveralMarks: Story = {
    args: {
        xml: buildSnippet({
            clef: "treble",
            fifths: 0,
            beatsPerBar: 4,
            notes: [
                { step: null, value: "quarter" },
                { step: "C", octave: 5, value: "quarter", dynamic: "p" },
                { step: "E", octave: 5, value: "half", dynamic: "f" },
            ],
        }),
    },
};
