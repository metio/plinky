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
                <p className="text-sm text-gray-700 dark:text-gray-300">
                    Adjust the tempo, metronome, and looping for this piece.
                </p>
                <button
                    type="button"
                    className="rounded-md border border-gray-300 px-3 py-1.5 text-sm dark:border-gray-700"
                >
                    A focusable control
                </button>
            </>
        ),
    },
};
