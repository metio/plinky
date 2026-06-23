// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { Meta, StoryObj } from "@storybook/react-vite";
import type { Hand } from "../lib/hands";
import { HandSelector } from "./handSelector";

const grandStaff: Hand[] = [
    { staff: 0, label: "Right", steps: [] },
    { staff: 1, label: "Left", steps: [] },
];

const meta: Meta<typeof HandSelector> = {
    title: "Components/HandSelector",
    component: HandSelector,
    args: { hands: grandStaff, value: "both", onChange: () => {} },
};
export default meta;

type Story = StoryObj<typeof HandSelector>;

export const BothHands: Story = {};
export const RightSelected: Story = { args: { value: 0 } };

// A single-hand piece needs no choice, so the selector renders nothing.
export const SingleHand: Story = { args: { hands: [grandStaff[0]] } };
