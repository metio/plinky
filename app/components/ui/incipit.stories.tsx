// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { Meta, StoryObj } from "@storybook/react-vite";
import type { Incipit } from "../../../core/incipit";
import { IncipitMark } from "./incipit";

const meta: Meta<typeof IncipitMark> = {
    title: "UI/IncipitMark",
    component: IncipitMark,
};
export default meta;

type Story = StoryObj<typeof IncipitMark>;

// Ode to Joy's opening, which is the shape most readers recognise fastest: E E F G,
// all on and around the treble staff.
const ODE: Incipit = {
    clef: "treble",
    notes: [30, 30, 31, 32, 32, 31, 30, 29].map((diatonic) => ({
        diatonic,
        alter: 0,
        quarters: 1,
    })),
};

// A line that leaves the staff at both ends, carries an accidental, and ends on a
// semibreve — every part of the drawing in one mark.
const RANGY: Incipit = {
    clef: "bass",
    notes: [
        { diatonic: 2 * 7 + 4, alter: 0, quarters: 1 },
        { diatonic: 2 * 7, alter: 0, quarters: 1 },
        { diatonic: 3 * 7 + 3, alter: 1, quarters: 0.5 },
        { diatonic: 3 * 7 + 6, alter: 0, quarters: 2 },
        { diatonic: 1 * 7 + 5, alter: -1, quarters: 4 },
    ],
};

export const Ink: Story = {
    args: { incipit: ODE, label: "Ode to Joy", className: "text-faint" },
};

export const ByNoteName: Story = {
    args: { incipit: ODE, label: "Ode to Joy", colored: true, className: "text-faint" },
};

export const LedgersAndAccidentals: Story = {
    args: { incipit: RANGY, label: "A wide-ranging opening", className: "text-faint" },
};
