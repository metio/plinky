// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { Meta, StoryObj } from "@storybook/react-vite";
import { ScoreBackup } from "./scoreBackup";

const meta: Meta<typeof ScoreBackup> = {
    title: "Components/ScoreBackup",
    component: ScoreBackup,
};
export default meta;

export const Default: StoryObj<typeof ScoreBackup> = {};
