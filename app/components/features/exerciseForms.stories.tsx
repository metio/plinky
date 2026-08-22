// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { Meta, StoryObj } from "@storybook/react-vite";
import type { ExerciseConfig } from "../../../core/exerciseGen";
import { ExerciseForms } from "./exerciseForms";

const meta: Meta<typeof ExerciseForms> = {
    title: "Features/ExerciseForms",
    component: ExerciseForms,
    decorators: [
        (Story) => (
            <div className="max-w-lg">
                <Story />
            </div>
        ),
    ],
};
export default meta;

type Story = StoryObj<typeof ExerciseForms>;

const config = (patch: Partial<ExerciseConfig>): ExerciseConfig => ({
    type: "major-scale",
    key: "c",
    octaves: 1,
    hands: "right",
    inversion: 0,
    interval: "single",
    ...patch,
});

// A scale: octaves, hands and — because this type supports them — the double
// stops. No inversion row, which belongs to arpeggios.
export const Scale: Story = { args: { config: config({}) } };

// An arpeggio grows the inversion row and loses contrary motion from the hands.
export const Arpeggio: Story = {
    args: { config: config({ type: "major-arpeggio", octaves: 2, inversion: 1 }) },
};

// Double stops don't combine with contrary motion, so choosing contrary takes
// the intervals row away rather than leaving a row that would do nothing.
export const Contrary: Story = { args: { config: config({ hands: "contrary" }) } };

// Every option already at its far end: two octaves, both hands, sixths.
export const Widest: Story = {
    args: { config: config({ octaves: 2, hands: "both", interval: "sixths" }) },
};
