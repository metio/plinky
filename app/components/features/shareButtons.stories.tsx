// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { Meta, StoryObj } from "@storybook/react-vite";
import { type Grid, shareText, svgCard } from "../../../core/shareCard";
import { ShareButtons } from "./shareButtons";

// The share row over a pinned payload. Copying and rasterising only run on a
// click, so the resting render is static.
const meta: Meta<typeof ShareButtons> = {
    title: "Features/ShareButtons",
    component: ShareButtons,
};
export default meta;

type Story = StoryObj<typeof ShareButtons>;

const grid: Grid = [["best", "best", "good", "ok", "good", "best"]];
const boast = "🎹 Plinky 42 A";

export const Default: Story = {
    args: {
        text: shareText(boast, grid),
        imageSvg: svgCard(grid, boast),
        imageText: boast,
    },
};
