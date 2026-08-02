// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { Meta, StoryObj } from "@storybook/react-vite";
import { Drawer } from "./drawer";

const meta: Meta<typeof Drawer> = {
    title: "UI/Drawer",
    component: Drawer,
};
export default meta;

type Story = StoryObj<typeof Drawer>;

export const Open: Story = {
    args: {
        open: true,
        onClose: () => {},
        title: "Practice settings",
        children: (
            <>
                <p className="text-sm text-body">
                    Adjust the tempo, metronome, and looping for this piece.
                </p>
                <button
                    type="button"
                    className="rounded-md border border-line-strong px-3 py-1.5 text-sm"
                >
                    A focusable control
                </button>
            </>
        ),
    },
};
