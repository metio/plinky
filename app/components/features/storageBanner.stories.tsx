// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { Meta, StoryObj } from "@storybook/react-vite";
import { StorageBanner, type StorageHealth } from "./storageBanner";

// The banner shows only while the injected health signal reports a failed write;
// a stub pins that state (healthy renders nothing at all).
const meta: Meta<typeof StorageBanner> = {
    title: "Features/StorageBanner",
    component: StorageBanner,
};
export default meta;

type Story = StoryObj<typeof StorageBanner>;

const failing: StorageHealth = {
    failed: () => true,
    subscribe: () => () => {},
};

export const WriteFailed: Story = {
    args: { health: failing },
};
