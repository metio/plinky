// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { Meta, StoryObj } from "@storybook/react-vite";
import { SongBackup } from "./songBackup";

const meta: Meta<typeof SongBackup> = {
    title: "Components/SongBackup",
    component: SongBackup,
};
export default meta;

export const Default: StoryObj<typeof SongBackup> = {};
