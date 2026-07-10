// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { Meta, StoryObj } from "@storybook/react-vite";
import { Attribution } from "./attribution";

const meta: Meta<typeof Attribution> = {
    title: "UI/Attribution",
    component: Attribution,
};
export default meta;

type Story = StoryObj<typeof Attribution>;

export const PublicDomain: Story = {
    args: { license: "CC0-1.0", source: "mutopia" },
};

export const AttributionRequired: Story = {
    args: { license: "CC-BY-SA-4.0", source: "kern" },
};

export const LicenseOnly: Story = {
    args: { license: "CC-BY-4.0" },
};
