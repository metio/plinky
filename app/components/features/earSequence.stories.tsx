// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { Meta, StoryObj } from "@storybook/react-vite";
import type { ChordDegree } from "../../../core/theory";
import { EarSequence } from "./earSequence";

const meta: Meta<typeof EarSequence> = {
    title: "Features/EarSequence",
    component: EarSequence,
};
export default meta;
type Story = StoryObj<typeof EarSequence>;

const SEQUENCE: ChordDegree[] = ["I", "IV", "V", "I"];
const VOCAB: ChordDegree[] = ["I", "IV", "V"];

// The live surface: empty slots to fill, the primary-chord keypad below.
export const Live: Story = {
    args: {
        sequence: SEQUENCE,
        choices: VOCAB,
        settled: false,
        onComplete: () => {},
        label: "Chord progression answer",
    },
};

// The full diatonic vocabulary, so the keypad shows all seven Roman numerals.
export const FullVocabulary: Story = {
    args: {
        sequence: ["I", "vi", "IV", "V"],
        choices: ["I", "ii", "iii", "IV", "V", "vi", "vii°"],
        settled: false,
        onComplete: () => {},
        label: "Chord progression answer",
    },
};
