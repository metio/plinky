// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { Meta, StoryObj } from "@storybook/react-vite";
import { ThemePicker } from "./themePicker";

const meta: Meta<typeof ThemePicker> = {
    title: "Components/ThemePicker",
    component: ThemePicker,
};
export default meta;

export const Default: StoryObj<typeof ThemePicker> = {};
