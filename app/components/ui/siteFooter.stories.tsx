// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { Meta, StoryObj } from "@storybook/react-vite";
import { SiteFooter } from "./siteFooter";

const meta: Meta<typeof SiteFooter> = {
    title: "UI/SiteFooter",
    component: SiteFooter,
};
export default meta;

type Story = StoryObj<typeof SiteFooter>;

export const Default: Story = {};
