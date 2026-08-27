// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { Meta, StoryObj } from "@storybook/react-vite";
import type { StorageHealth } from "../../ports/storageHealth";
import { StorageBanner } from "./storageBanner";

// The banner shows only while the injected health signal reports a failed write;
// a stub pins that state (healthy renders nothing at all).
const meta: Meta<typeof StorageBanner> = {
    title: "Features/StorageBanner",
    component: StorageBanner,
};
export default meta;

type Story = StoryObj<typeof StorageBanner>;

const failing: StorageHealth = {
    problem: () => "refused",
    subscribe: () => () => {},
};

// A tab still running an older build on a device a newer one has written to. Writing
// would overwrite a shape this build cannot represent, so it stops — and says the true
// reason, since "storage is full" would send the reader off deleting files for nothing.
const stale: StorageHealth = {
    problem: () => "stale",
    subscribe: () => () => {},
};

export const WriteFailed: Story = {
    args: { health: failing },
};

export const StaleBuild: Story = {
    args: { health: stale },
};
