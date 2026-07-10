// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { Meta, StoryObj } from "@storybook/react-vite";
import type { Grid } from "../../../core/shareCard";
import { ShareCard } from "./shareCard";

const ROW_LABELS = ["Accuracy", "Timing", "Flow"];

const STRONG: Grid = [
    ["best", "best", "good", "best", "best", "best"],
    ["best", "good", "best", "best", "good", "best"],
    ["best", "best", "best", "best", "best", "best"],
];

const MIXED: Grid = [
    ["good", "ok", "best", "weak", "good", "good"],
    ["ok", "weak", "ok", "good", "ok", "weak"],
    ["good", "good", "ok", "ok", "none", "none"],
];

const meta: Meta<typeof ShareCard> = {
    title: "Features/ShareCard",
    component: ShareCard,
};
export default meta;

type Story = StoryObj<typeof ShareCard>;

export const StrongRun: Story = {
    args: {
        grid: STRONG,
        caption: "How the run went, moment by moment",
        gridLabel: "Run share grid",
        rowLabels: ROW_LABELS,
        boast: "An S on Ode to Joy!",
        heading: "Ode to Joy",
    },
};

export const MixedRun: Story = {
    args: {
        grid: MIXED,
        caption: "How the run went, moment by moment",
        gridLabel: "Run share grid",
        rowLabels: ROW_LABELS,
        boast: "Working through Minuet in G",
        heading: "Minuet in G",
    },
};
