// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { Meta, StoryObj } from "@storybook/react-vite";
import { LanguageSwitcher } from "./languageSwitcher";

const meta: Meta<typeof LanguageSwitcher> = {
    title: "UI/LanguageSwitcher",
    component: LanguageSwitcher,
};
export default meta;

type Story = StoryObj<typeof LanguageSwitcher>;

export const Default: Story = {};
