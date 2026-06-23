// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { Meta, StoryObj } from "@storybook/react-vite";
import { AbcRenderer } from "./abcRenderer";

const meta: Meta<typeof AbcRenderer> = {
    title: "Components/AbcRenderer",
    component: AbcRenderer,
};
export default meta;

type Story = StoryObj<typeof AbcRenderer>;

export const Melody: Story = {
    args: { abcTune: "X:1\nT:Scale\nM:4/4\nL:1/4\nK:C\nC D E F | G A B c |" },
};

export const GrandStaff: Story = {
    args: {
        abcTune:
            "X:1\nT:Two hands\nM:4/4\nL:1/4\nV:1 clef=treble\nV:2 clef=bass\nV:1\nK:C\nc e g e |\nV:2\nC, G, C, G, |",
    },
};
