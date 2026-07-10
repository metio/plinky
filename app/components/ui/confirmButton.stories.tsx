// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { Meta, StoryObj } from "@storybook/react-vite";
import { userEvent, within } from "storybook/test";
import { ConfirmButton } from "./confirmButton";
import { CloseIcon } from "./icons";

const meta: Meta<typeof ConfirmButton> = {
    title: "UI/ConfirmButton",
    component: ConfirmButton,
};
export default meta;

type Story = StoryObj<typeof ConfirmButton>;

export const AtRest: Story = {
    args: {
        onConfirm: () => {},
        confirmLabel: "Delete everything?",
        children: "Delete everything",
        variant: "danger",
    },
};

// The first click arms the button, swapping in the red confirm + cancel pair.
export const Armed: Story = {
    args: {
        onConfirm: () => {},
        confirmLabel: "Delete everything?",
        children: "Delete everything",
        variant: "danger",
    },
    play: async ({ canvasElement }) => {
        await userEvent.click(within(canvasElement).getByRole("button"));
    },
};

export const IconTrigger: Story = {
    args: {
        onConfirm: () => {},
        confirmLabel: "Remove take?",
        label: "Remove take",
        variant: "ghost",
        children: <CloseIcon />,
    },
};
