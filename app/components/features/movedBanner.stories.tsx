// SPDX-FileCopyrightText: The Klimpi Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { Meta, StoryObj } from "@storybook/react-vite";
import { MovedBanner } from "./movedBanner";

const meta: Meta<typeof MovedBanner> = { title: "Features/MovedBanner", component: MovedBanner };
export default meta;

type Story = StoryObj<typeof MovedBanner>;

// Only ever seen on the address Klimpi answered to before the rebrand. The message takes
// the full width and the two links sit under it, because three things on one line leave
// the sentence about eighty pixels on a narrow phone.
export const OnTheOldAddress: Story = { args: { offer: true } };
