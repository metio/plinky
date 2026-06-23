// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { Meta, StoryObj } from "@storybook/react-vite";
import { BeatIndicator } from "./beatIndicator";

const meta: Meta<typeof BeatIndicator> = {
    title: "Components/BeatIndicator",
    component: BeatIndicator,
};
export default meta;

type Story = StoryObj<typeof BeatIndicator>;

export const Downbeat: Story = {
    args: { beat: 1, beatsPerBar: 4 },
};

export const ThirdBeat: Story = {
    args: { beat: 3, beatsPerBar: 4 },
};

export const ThreeFour: Story = {
    args: { beat: 2, beatsPerBar: 3 },
};
