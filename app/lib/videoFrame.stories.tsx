// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { Meta, StoryObj } from "@storybook/react-vite";
import { useEffect, useRef } from "react";
import { LEAD_IN_MS } from "../../core/videoFrames";
import { takeScenePainter } from "./videoPainter";

// Golden frames of the exported video: each story paints one exact frame of a
// fixed take, so the committed baselines pin what a shared video looks like at
// that instant — the lit key's press decay included. The painter is pure, so a
// frame is fully determined by the take and the timestamp.
const TAKE = {
    title: "Menuet",
    credit: "Menuet · J. S. Bach · CC0",
    // Middle C held long, then re-pressed; E joins for a chord. The re-press at
    // 2000ms is what the fade makes visible.
    notes: [
        { pitch: 60, startMs: 0, durationMs: 1800, velocity: 100 },
        { pitch: 64, startMs: 400, durationMs: 600, velocity: 100 },
        { pitch: 60, startMs: 2000, durationMs: 600, velocity: 100 },
    ],
    durationMs: LEAD_IN_MS + 4_000,
    width: 640,
    height: 360,
};

function VideoFrame({ timeMs }: { timeMs: number }) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    useEffect(() => {
        const context = canvasRef.current?.getContext("2d");
        if (context) {
            takeScenePainter(TAKE)(context, timeMs);
        }
    }, [timeMs]);
    return <canvas ref={canvasRef} width={TAKE.width} height={TAKE.height} />;
}

const meta: Meta<typeof VideoFrame> = {
    title: "Lib/VideoFrame",
    component: VideoFrame,
};
export default meta;

type Story = StoryObj<typeof VideoFrame>;

// The still lead-in: no key lit, progress rail at the start.
export const LeadIn: Story = { args: { timeMs: 0 } };

// The first press, one frame in: the key at full accent.
export const FreshPress: Story = { args: { timeMs: LEAD_IN_MS + 40 } };

// The same note held long plus the chord partner gone: the glow decayed
// toward the floor but still clearly down.
export const HeldAndFaded: Story = { args: { timeMs: LEAD_IN_MS + 1_700 } };

// The re-press of the same key: back to full glory.
export const RePressed: Story = { args: { timeMs: LEAD_IN_MS + 2_040 } };
