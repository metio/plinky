// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

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

// The rhythm trainer's use: the dashed line is the tempo the player CHOSE rather than their
// own median, and each dot carries the same verdict colour its notehead does above the
// graph — green on time, amber close, red out.
export const GradedTaps: Story = {
    args: {
        median: 60,
        hotspots: [],
        medianLabel: (bpm) => `your tempo: ${bpm}`,
        dotColor: (index) =>
            [null, "var(--color-success)", "var(--color-warn)", "var(--color-danger)"][index % 4] as
                | string
                | null,
    },
};
