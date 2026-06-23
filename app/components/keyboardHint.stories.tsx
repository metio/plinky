// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { Meta, StoryObj } from "@storybook/react-vite";
import { KeyboardHint } from "./keyboardHint";

const meta: Meta<typeof KeyboardHint> = {
    title: "Components/KeyboardHint",
    component: KeyboardHint,
};
export default meta;

type Story = StoryObj<typeof KeyboardHint>;

export const Default: Story = {
    args: { octaveOffset: 0 },
};

export const ShiftedUp: Story = {
    args: { octaveOffset: 1 },
};
