// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { RecordedNote } from "../../core/composition";
import { frameAt, pressGlow } from "../../core/videoFrames";
import { type SceneKey, sceneKeys, sceneRange } from "../../core/videoScene";

// Paints one frame of the exported video: a dark stage with the piece's title,
// a progress rail, the keyboard with the sounding keys lit, and the credit
// line with the wordmark — so a shared file carries its provenance and origin
// wherever it's reposted. Pure canvas drawing over the pure scene geometry;
// the exporter calls it once per frame.

// Blend two #rrggbb colours; amount 0 gives `from`, 1 gives `to`.
function mixHex(from: string, to: string, amount: number): string {
    let out = "#";
    for (let channel = 0; channel < 3; channel++) {
        const a = Number.parseInt(from.slice(1 + channel * 2, 3 + channel * 2), 16);
        const b = Number.parseInt(to.slice(1 + channel * 2, 3 + channel * 2), 16);
        out += Math.round(a + (b - a) * amount)
            .toString(16)
            .padStart(2, "0");
    }
    return out;
}

const BACKGROUND = "#0b0f1a";
const INK = "#f9fafb";
const MUTED = "#9ca3af";
const ACCENT = "#6366f1";
const WHITE_KEY = "#f3f4f6";
const BLACK_KEY = "#111827";

export type ScenePainterInput = {
    title: string;
    // The provenance line from core/videoScene's creditLine.
    credit: string;
    notes: RecordedNote[];
    durationMs: number;
    width: number;
    height: number;
};

type Context2D = Pick<
    OffscreenCanvasRenderingContext2D,
    "fillRect" | "fillText" | "beginPath" | "roundRect" | "fill" | "save" | "restore"
> & {
    fillStyle: string | CanvasGradient | CanvasPattern;
    font: string;
    textBaseline: CanvasTextBaseline;
    textAlign: CanvasTextAlign;
};

export function takeScenePainter({
    title,
    credit,
    notes,
    durationMs,
    width,
    height,
}: ScenePainterInput): (context: Context2D, timeMs: number) => void {
    const { from, to } = sceneRange(notes.map((note) => note.pitch));
    const keys = sceneKeys(from, to);
    const keyboardTop = height * 0.42;
    const keyboardHeight = height * 0.4;
    const margin = Math.round(width * 0.05);

    // A sounding key is painted as the resting colour blended toward the accent
    // by its glow — full at the press, decaying while held — so a repeated press
    // of the same key visibly re-lights it instead of merging into one long hold.
    const drawKey = (context: Context2D, key: SceneKey, glow: number | null) => {
        const x = margin + key.x * (width - margin * 2);
        const w = key.width * (width - margin * 2);
        const h = key.black ? keyboardHeight * 0.62 : keyboardHeight;
        const rest = key.black ? BLACK_KEY : WHITE_KEY;
        context.fillStyle = glow === null ? rest : mixHex(rest, ACCENT, glow);
        context.beginPath();
        context.roundRect(x + w * 0.04, keyboardTop, w * 0.92, h, 4);
        context.fill();
    };

    return (context, timeMs) => {
        const frame = frameAt(notes, timeMs);
        context.fillStyle = BACKGROUND;
        context.fillRect(0, 0, width, height);

        context.textAlign = "left";
        context.textBaseline = "top";
        context.fillStyle = INK;
        context.font = `600 ${Math.round(height * 0.06)}px Inter, system-ui, sans-serif`;
        context.fillText(title, margin, height * 0.08);
        context.textAlign = "right";
        context.fillStyle = MUTED;
        context.font = `500 ${Math.round(height * 0.035)}px Inter, system-ui, sans-serif`;
        context.fillText("plinky.fun", width - margin, height * 0.09);

        // The progress rail between title and keys.
        const railY = height * 0.26;
        context.fillStyle = "#1f2937";
        context.fillRect(margin, railY, width - margin * 2, 4);
        context.fillStyle = ACCENT;
        context.fillRect(margin, railY, (width - margin * 2) * (timeMs / durationMs), 4);

        // White keys first so the black keys straddle on top; sounding keys lit
        // by the freshest press of their pitch, so a re-press during a long hold
        // still snaps back to full.
        const held = new Map<number, number>();
        for (const entry of frame.down) {
            const freshest = held.get(entry.pitch);
            if (freshest === undefined || entry.heldMs < freshest) {
                held.set(entry.pitch, entry.heldMs);
            }
        }
        const glowOf = (pitch: number) => {
            const heldMs = held.get(pitch);
            return heldMs === undefined ? null : pressGlow(heldMs);
        };
        for (const key of keys.filter((entry) => !entry.black)) {
            drawKey(context, key, glowOf(key.pitch));
        }
        for (const key of keys.filter((entry) => entry.black)) {
            drawKey(context, key, glowOf(key.pitch));
        }

        context.textAlign = "left";
        context.textBaseline = "alphabetic";
        context.fillStyle = MUTED;
        context.font = `400 ${Math.round(height * 0.032)}px Inter, system-ui, sans-serif`;
        context.fillText(credit, margin, height * 0.95);
    };
}
