// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { Meta, StoryObj } from "@storybook/react-vite";
import { UpdateBanner } from "./updateBanner";

const meta: Meta<typeof UpdateBanner> = { title: "Features/UpdateBanner", component: UpdateBanner };
export default meta;

type Story = StoryObj<typeof UpdateBanner>;

// The one case worth a word: this device can no longer receive new versions, and
// nothing else would ever reveal it. There is deliberately no banner for an
// update being *available* — a waiting build takes over by itself.
export const Broken: Story = { args: { updateBroken: true } };
