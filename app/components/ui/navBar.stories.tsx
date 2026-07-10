// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { Meta, StoryObj } from "@storybook/react-vite";
import { BottomNav, HeaderNav } from "./navBar";

const meta: Meta<typeof BottomNav> = {
    title: "UI/NavBar",
    component: BottomNav,
};
export default meta;

type Story = StoryObj<typeof BottomNav>;

// The fixed bottom tab bar; hidden by its own md:hidden on a wide preview, so
// narrow the viewport to see it.
export const Bottom: Story = {
    render: () => <BottomNav />,
};

export const Header: Story = {
    render: () => <HeaderNav className="flex items-center gap-1" />,
};
