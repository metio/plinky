// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { Meta, StoryObj } from "@storybook/react-vite";
import { TempoGraph } from "./tempoGraph";

const points = [60, 62, 58, 64, 55, 66, 61].map((bpm, index) => ({ index, bpm }));

const meta: Meta<typeof TempoGraph> = {
    title: "Components/TempoGraph",
    component: TempoGraph,
    args: { points, median: 60, hotspots: [] },
};
export default meta;

type Story = StoryObj<typeof TempoGraph>;

export const Steady: Story = {};

export const WithHotspot: Story = {
    args: { hotspots: [{ startIndex: 4, endIndex: 4 }] },
};

export const TwoHands: Story = {
    args: {
        series: [
            { label: "Right hand", points, color: "#4f46e5" },
            {
                label: "Left hand",
                points: points.map((point) => ({ ...point, bpm: point.bpm - 6 })),
                color: "#ea580c",
            },
        ],
    },
};
