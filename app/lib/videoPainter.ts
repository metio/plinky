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
    scorePanelRect,
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

// The exact family the app registers (see the fontsource import in root.tsx and
// --font-sans in app.css). A canvas resolves font strings against the loaded
// faces only — a family name nothing registered silently falls through to the
// next entry, which would tie an exported video's text to whatever the
// recording machine happened to install.
export const FONT_FAMILY = '"Inter Variable", system-ui, sans-serif';

// A canvas font string at `unit`-relative size, so text scales with the frame.
function fontAt(weight: number, scale: number, unit: number): string {
    return `${weight} ${Math.round(unit * scale)}px ${FONT_FAMILY}`;
}

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
    // Whether the on-screen keyboard is part of the stage. Off hands the whole
    // stage to the notation (ignored when there is no score to show instead).
    keyboard?: boolean;
    // Treadmill: the score arrives engraved as one horizontal line, and the
    // panel scrolls it sideways under a fixed gaze instead of down the page.
    treadmill?: boolean;
    // Whether the piece's title is burnt into the top-left. The provenance
    // credit line is never affected — the catalogue is credit-required.
    showTitle?: boolean;
    // Whether the plinky.fun wordmark rides the top-right.
    showWordmark?: boolean;
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
    | "measureText"
> & {
    fillStyle: string | CanvasGradient | CanvasPattern;
    font: string;
    textBaseline: CanvasTextBaseline;
    textAlign: CanvasTextAlign;
    globalAlpha: number;
};

// Trim text to fit `room` in the context's current font, ending in an ellipsis
// when anything had to go.
function ellipsize(context: Context2D, text: string, room: number): string {
    if (context.measureText(text).width <= room) {
        return text;
    }
    let keep = text.length;
    while (keep > 0 && context.measureText(`${text.slice(0, keep)}…`).width > room) {
        keep--;
    }
    return `${text.slice(0, keep)}…`;
}

export function takeScenePainter({
    title,
    credit,
    notes,
    durationMs,
    width,
    height,
    score = null,
    keyboard = true,
    treadmill = false,
    showTitle = true,
    showWordmark = true,
}: ScenePainterInput): (context: Context2D, timeMs: number) => void {
    const { from, to } = sceneRange(notes.map((note) => note.pitch));
    const keys = sceneKeys(from, to);
    // With a notation panel the keyboard cedes the middle of the stage to it.
    // A portrait frame drops the keyboard entirely (on the vertical feeds the
    // notation is the story, and the full-height panel keeps its glyphs readable
    // on a phone), and the exporter can drop it by choice — but only when a
    // score exists to fill the stage instead.
    const scoreOnly = score !== null && (height > width || !keyboard);
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

        // The wordmark measures first so the title knows where it must stop —
        // on a narrow portrait frame a long title would otherwise run under it.
        // With the wordmark off, the title reclaims that room.
        context.font = fontAt(500, 0.035, unit);
        const wordmarkWidth = showWordmark ? context.measureText("plinky.fun").width : 0;
        if (showTitle) {
            context.textAlign = "left";
            context.textBaseline = "top";
            context.fillStyle = INK;
            context.font = fontAt(600, 0.06, unit);
            const titleRoom = width - margin * 2 - wordmarkWidth - (showWordmark ? unit * 0.04 : 0);
            context.fillText(ellipsize(context, title, titleRoom), margin, height * 0.08);
        }
        if (showWordmark) {
            context.textAlign = "right";
            context.textBaseline = "top";
            context.fillStyle = MUTED;
            context.font = fontAt(500, 0.035, unit);
            context.fillText("plinky.fun", width - margin, height * 0.09);
        }

        // The progress rail between title and keys.
        const railY = height * 0.26;
        context.fillStyle = "#1f2937";
        context.fillRect(margin, railY, width - margin * 2, 4);
        context.fillStyle = ACCENT;
        context.fillRect(margin, railY, (width - margin * 2) * (timeMs / durationMs), 4);

        if (score) {
            drawScore(context, score, frame.currentOnsetMs, timeMs);
        }

        if (scoreOnly) {
            drawCredit(context);
            return;
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

        drawCredit(context);
    };

    function drawCredit(context: Context2D) {
        context.textAlign = "left";
        context.textBaseline = "alphabetic";
        context.fillStyle = MUTED;
        context.font = fontAt(400, 0.032, unit);
        context.fillText(credit, margin, height * 0.95);
    }

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
        const panelW = width - margin * 2;
        // Score-only frames give the panel the keyboard's room as well, down to
        // just above the credit line. A piece shorter than the band shrinks the
        // card to the sheet and centres it, instead of trailing blank white. A
        // treadmill sheet is one shallow line: its band height comes from the
        // sheet itself (scaled to the panel's width budget), centred in the band.
        const band = scoreOnly
            ? { y: height * 0.3, height: height * 0.6 }
            : { y: height * 0.3, height: height * 0.32 };
        const played = playedStepCount(onsets, currentOnsetMs);
        // The window glides between step centres with the music, never jumping.
        const centers = sheet.steps.map((group) => {
            const box = group[0];
            return box ? (treadmill ? box.x + box.width / 2 : box.y + box.height / 2) : 0;
        });
        const center = stepCenterAt(onsets, centers, timeMs - LEAD_IN_MS);

        // The treadmill slides a horizontal window sized to show a musical
        // phrase (~8 steps by their average spacing), never up-scaled past the
        // band's height; the page layout scales by width and slides down.
        let scale: number;
        if (treadmill) {
            const spacing =
                centers.length > 1
                    ? (centers[centers.length - 1]! - centers[0]!) / (centers.length - 1)
                    : sheet.width;
            const desiredWindow = Math.min(sheet.width, Math.max(spacing * 8, sheet.height * 4));
            // Between two guardrails: never taller than the band, never shrunk
            // below a readable strip — a sparse engraving zooms in rather than
            // becoming a hairline.
            const fit = Math.min(band.height / sheet.height, panelW / desiredWindow);
            scale = Math.max(fit, Math.min(band.height, unit * 0.14) / sheet.height);
        } else {
            scale = panelW / sheet.width;
        }
        const panelH = treadmill
            ? Math.min(band.height, sheet.height * scale)
            : scorePanelRect(band, panelW, sheet).height;
        const panelY = band.y + (band.height - panelH) / 2;
        const windowW = treadmill ? panelW / scale : sheet.width;
        const windowH = treadmill ? sheet.height : panelH / scale;
        const left = treadmill ? scoreWindowTop(center, windowW, sheet.width) : 0;
        const top = treadmill ? 0 : scoreWindowTop(center, windowH, sheet.height);

        context.save();
        context.fillStyle = INK;
        context.beginPath();
        context.roundRect(panelX, panelY, panelW, panelH, 8);
        context.fill();
        context.clip();
        context.drawImage(sheet.image, left, top, windowW, windowH, panelX, panelY, panelW, panelH);
        // Tint the played steps' noteheads; the freshest press reads strongest.
        for (let index = 0; index < played && index < sheet.steps.length; index++) {
            context.fillStyle = ACCENT;
            context.globalAlpha = index === played - 1 ? 0.5 : 0.3;
            for (const box of sheet.steps[index] ?? []) {
                context.beginPath();
                context.roundRect(
                    panelX + (box.x - left - 1) * scale,
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
