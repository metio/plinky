// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { Meta, StoryObj } from "@storybook/react-vite";
import { ThemeToggle } from "./themeToggle";

const meta: Meta<typeof ThemeToggle> = {
    title: "Components/ThemeToggle",
    component: ThemeToggle,
};
export default meta;

export const Default: StoryObj<typeof ThemeToggle> = {};
