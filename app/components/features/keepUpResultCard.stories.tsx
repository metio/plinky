// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { Meta, StoryObj } from "@storybook/react-vite";
import { KeepUpResultCard } from "./keepUpResultCard";

const meta: Meta<typeof KeepUpResultCard> = {
    title: "Features/KeepUpResultCard",
    component: KeepUpResultCard,
};
export default meta;

type Story = StoryObj<typeof KeepUpResultCard>;

export const PerfectRun: Story = {
    args: { result: { inTime: 48, total: 48, letter: "S" } },
};

export const MostlyInTime: Story = {
    args: { result: { inTime: 39, total: 48, letter: "B" } },
};

export const RoughRide: Story = {
    args: { result: { inTime: 11, total: 48, letter: "F" } },
};
