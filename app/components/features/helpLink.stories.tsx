// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { Meta, StoryObj } from "@storybook/react-vite";
import { HelpLink } from "./helpLink";

// The control itself looks the same everywhere; the current path only changes the
// help anchor it targets. The decorator's router puts the story at "/", so the
// link points at the home section.
const meta: Meta<typeof HelpLink> = {
    title: "Features/HelpLink",
    component: HelpLink,
};
export default meta;

type Story = StoryObj<typeof HelpLink>;

export const Default: Story = {};
