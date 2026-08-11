// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { Meta, StoryObj } from "@storybook/react-vite";
import { ScoreBackup } from "./scoreBackup";

const meta: Meta<typeof ScoreBackup> = {
    title: "Components/ScoreBackup",
    component: ScoreBackup,
};
export default meta;

export const Default: StoryObj<typeof ScoreBackup> = {};
