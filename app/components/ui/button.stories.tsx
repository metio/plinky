// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button, IconButton } from "./button";
import { CheckIcon } from "./icons";

const meta: Meta<typeof Button> = {
    title: "UI/Button",
    component: Button,
};
export default meta;

type Story = StoryObj<typeof Button>;

export const Variants: Story = {
    render: () => (
        <div className="flex items-center gap-2">
            <Button variant="primary">Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="danger">Danger</Button>
        </div>
    ),
};

export const Disabled: Story = {
    args: { variant: "primary", disabled: true, children: "Disabled" },
};

export const Icon: Story = {
    render: () => (
        <IconButton variant="ghost" label="Mark learned">
            <CheckIcon />
        </IconButton>
    ),
};
