// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { RecordedNote } from "../../core/composition";
import { frameAt, LEAD_IN_MS, pressGlow } from "../../core/videoFrames";
import {
    playedStepCount,
    type SceneKey,
    sceneKeys,
    sceneRange,
    type ScoreBox,
    scoreWindowTop,
    stepCenterAt,
} from "../../core/videoScene";

// Paints one frame of the exported video: a dark stage with the piece's title,
// a progress rail, the notation (when a snapshot was rendered) with the played
// notes tinted, the keyboard with the sounding keys lit, and the credit line
// with the wordmark — so a shared file carries its provenance and origin
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

// The pre-rendered notation the frame can carry: the score rasterized once,
// plus each step's notehead boxes on it (in image pixels, playing order).
export type SceneScore = {
    image: CanvasImageSource;
    width: number;
    height: number;
    steps: ScoreBox[][];
};

export type ScenePainterInput = {
    title: string;
    // The provenance line from core/videoScene's creditLine.
    credit: string;
    notes: RecordedNote[];
    durationMs: number;
    width: number;
    height: number;
    // Optional notation panel; without it the keyboard fills the stage as before.
    score?: SceneScore | null;
};

type Context2D = Pick<
    OffscreenCanvasRenderingContext2D,
    | "fillRect"
    | "fillText"
    | "beginPath"
    | "roundRect"
    | "fill"
    | "save"
    | "restore"
    | "drawImage"
    | "clip"
> & {
    fillStyle: string | CanvasGradient | CanvasPattern;
    font: string;
    textBaseline: CanvasTextBaseline;
    textAlign: CanvasTextAlign;
    globalAlpha: number;
};

export function takeScenePainter({
    title,
    credit,
    notes,
    durationMs,
    width,
    height,
    score = null,
}: ScenePainterInput): (context: Context2D, timeMs: number) => void {
    const { from, to } = sceneRange(notes.map((note) => note.pitch));
    const keys = sceneKeys(from, to);
    // With a notation panel the keyboard cedes the middle of the stage to it.
    const keyboardTop = score ? height * 0.66 : height * 0.42;
    const keyboardHeight = score ? height * 0.24 : height * 0.4;
    const margin = Math.round(width * 0.05);
    // Portrait frames are taller than wide; type scales by the smaller side so
    // titles stay titles instead of billboards.
    const unit = Math.min(width, height);
    // The run's distinct onsets in playing order — step i of the snapshot sounded
    // at onsets[i], mirroring how the matcher and the take both count steps.
    const onsets = [...new Set(notes.map((note) => note.startMs))].sort((a, b) => a - b);

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
        context.font = `600 ${Math.round(unit * 0.06)}px Inter, system-ui, sans-serif`;
        context.fillText(title, margin, height * 0.08);
        context.textAlign = "right";
        context.fillStyle = MUTED;
        context.font = `500 ${Math.round(unit * 0.035)}px Inter, system-ui, sans-serif`;
        context.fillText("plinky.fun", width - margin, height * 0.09);

        // The progress rail between title and keys.
        const railY = height * 0.26;
        context.fillStyle = "#1f2937";
        context.fillRect(margin, railY, width - margin * 2, 4);
        context.fillStyle = ACCENT;
        context.fillRect(margin, railY, (width - margin * 2) * (timeMs / durationMs), 4);

        if (score) {
            drawScore(context, score, frame.currentOnsetMs, timeMs);
        }

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
        context.font = `400 ${Math.round(unit * 0.032)}px Inter, system-ui, sans-serif`;
        context.fillText(credit, margin, height * 0.95);
    };

    // The notation panel: a light card holding a window of the score image that
    // follows the current step down the page, with every played step's noteheads
    // tinted in the accent — the sheet-music twin of the lit keys below it.
    function drawScore(
        context: Context2D,
        sheet: SceneScore,
        currentOnsetMs: number | null,
        timeMs: number,
    ) {
        const panelX = margin;
        const panelY = height * 0.3;
        const panelW = width - margin * 2;
        const panelH = height * 0.32;
        const scale = panelW / sheet.width;
        const windowH = panelH / scale;
        const played = playedStepCount(onsets, currentOnsetMs);
        // The window glides between step centres with the music, never jumping.
        const centers = sheet.steps.map((group) => {
            const box = group[0];
            return box ? box.y + box.height / 2 : 0;
        });
        const centerY = stepCenterAt(onsets, centers, timeMs - LEAD_IN_MS);
        const top = scoreWindowTop(centerY, windowH, sheet.height);

        context.save();
        context.fillStyle = INK;
        context.beginPath();
        context.roundRect(panelX, panelY, panelW, panelH, 8);
        context.fill();
        context.clip();
        context.drawImage(
            sheet.image,
            0,
            top,
            sheet.width,
            windowH,
            panelX,
            panelY,
            panelW,
            panelH,
        );
        // Tint the played steps' noteheads; the freshest press reads strongest.
        for (let index = 0; index < played && index < sheet.steps.length; index++) {
            context.fillStyle = ACCENT;
            context.globalAlpha = index === played - 1 ? 0.5 : 0.3;
            for (const box of sheet.steps[index] ?? []) {
                context.beginPath();
                context.roundRect(
                    panelX + (box.x - 1) * scale,
                    panelY + (box.y - top - 1) * scale,
                    (box.width + 2) * scale,
                    (box.height + 2) * scale,
                    2,
                );
                context.fill();
            }
        }
        context.restore();
        context.globalAlpha = 1;
    }
}
