// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { Meta, StoryObj } from "@storybook/react-vite";
import { GradeChip } from "./scoreGrade";

// The chip from a known grade number — one story per difficulty band, since the
// tint is the only visual variable. ScoreGrade merely computes the number from
// MusicXML before rendering the same chip.
const meta: Meta<typeof GradeChip> = {
    title: "Features/ScoreGrade",
    component: GradeChip,
};
export default meta;

type Story = StoryObj<typeof GradeChip>;

export const LowBand: Story = {
    args: { grade: 2 },
};

export const MidBand: Story = {
    args: { grade: 4 },
};

export const HighBand: Story = {
    args: { grade: 7 },
};
