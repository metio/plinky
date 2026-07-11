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

// A deterministic stand-in sheet: staff lines and notehead dots drawn onto a
// canvas synchronously, so the score-mode frames rasterize identically without
// a real (async) notation render.
function fakeSheet(): {
    image: HTMLCanvasElement;
    steps: { x: number; y: number; width: number; height: number }[][];
} {
    const image = document.createElement("canvas");
    image.width = 1200;
    image.height = 260;
    const ctx = image.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, 1200, 260);
    ctx.fillStyle = "#111827";
    for (let line = 0; line < 5; line++) {
        ctx.fillRect(40, 80 + line * 14, 1120, 2);
    }
    const steps = [0, 1, 2].map((step) => {
        const x = 160 + step * 320;
        ctx.beginPath();
        ctx.ellipse(x + 11, 108, 11, 8, -0.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(x + 20, 52, 2, 54);
        return [{ x, y: 96, width: 24, height: 22 }];
    });
    return { image, steps };
}

function ScoreFrame({ timeMs }: { timeMs: number }) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    useEffect(() => {
        const context = canvasRef.current?.getContext("2d");
        if (context) {
            const sheet = fakeSheet();
            takeScenePainter({
                ...TAKE,
                score: { image: sheet.image, width: 1200, height: 260, steps: sheet.steps },
            })(context, timeMs);
        }
    }, [timeMs]);
    return <canvas ref={canvasRef} width={TAKE.width} height={TAKE.height} />;
}

// Score mode, mid-piece: the second step just sounded — its notehead tinted
// strongest, the first more quietly, the third still ink.
export const ScoreMidPiece: Story = {
    render: () => <ScoreFrame timeMs={LEAD_IN_MS + 440} />,
};

// Score mode at the lead-in: the untouched sheet above the resting keyboard.
export const ScoreLeadIn: Story = {
    render: () => <ScoreFrame timeMs={0} />,
};
