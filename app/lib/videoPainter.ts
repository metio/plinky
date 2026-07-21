// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { RecordedNote } from "../../core/composition";
import { frameAt, LEAD_IN_MS, pressGlow } from "../../core/videoFrames";
import {
    highwayBlocks,
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
    // The resting white / black key hex from the chosen keyboard skin, so the video's
    // keys match the app. Absent falls back to the classic palette.
    keyColors?: { white: string; black: string };
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

// The stage furniture shared by every format: the piece's title, the wordmark,
// and the credit line — measured and placed the same way whatever fills the
// middle (staff or highway).
type ChromeConfig = {
    title: string;
    credit: string;
    width: number;
    height: number;
    unit: number;
    margin: number;
    durationMs: number;
    showTitle: boolean;
    showWordmark: boolean;
};

// The dark background, the optional title (left) and wordmark (right), and the
// progress rail between them and the stage.
function paintChrome(context: Context2D, cfg: ChromeConfig, timeMs: number): void {
    const { title, width, height, unit, margin, durationMs, showTitle, showWordmark } = cfg;
    context.fillStyle = BACKGROUND;
    context.fillRect(0, 0, width, height);
    // The wordmark measures first so the title knows where it must stop — on a
    // narrow portrait frame a long title would otherwise run under it. With the
    // wordmark off, the title reclaims that room.
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
    const railY = height * 0.26;
    context.fillStyle = "#1f2937";
    context.fillRect(margin, railY, width - margin * 2, 4);
    context.fillStyle = ACCENT;
    context.fillRect(margin, railY, (width - margin * 2) * (timeMs / durationMs), 4);
}

// The provenance line along the foot — a shared file carries its credit.
function paintCredit(context: Context2D, cfg: ChromeConfig): void {
    context.textAlign = "left";
    context.textBaseline = "alphabetic";
    context.fillStyle = MUTED;
    context.font = fontAt(400, 0.032, cfg.unit);
    context.fillText(cfg.credit, cfg.margin, cfg.height * 0.95);
}

// Where the keyboard sits, so one key-drawing routine serves both formats.
type KeyLayout = {
    margin: number;
    width: number;
    keyboardTop: number;
    keyboardHeight: number;
    // The resting white / black key hex, from the chosen keyboard skin.
    white: string;
    black: string;
};

// A sounding key is the resting colour blended toward the accent by its glow —
// full at the press, decaying while held — so a repeated press of the same key
// visibly re-lights it instead of merging into one long hold.
function paintKey(context: Context2D, key: SceneKey, glow: number | null, l: KeyLayout): void {
    const x = l.margin + key.x * (l.width - l.margin * 2);
    const w = key.width * (l.width - l.margin * 2);
    const h = key.black ? l.keyboardHeight * 0.62 : l.keyboardHeight;
    const rest = key.black ? l.black : l.white;
    context.fillStyle = glow === null ? rest : mixHex(rest, ACCENT, glow);
    context.beginPath();
    context.roundRect(x + w * 0.04, l.keyboardTop, w * 0.92, h, 4);
    context.fill();
}

// The freshest press glow per sounding pitch, so a re-press during a long hold
// still snaps back to full instead of merging into the decaying hold.
function keyGlows(down: readonly { pitch: number; heldMs: number }[]): Map<number, number> {
    const held = new Map<number, number>();
    for (const entry of down) {
        const freshest = held.get(entry.pitch);
        if (freshest === undefined || entry.heldMs < freshest) {
            held.set(entry.pitch, entry.heldMs);
        }
    }
    const glows = new Map<number, number>();
    for (const [pitch, heldMs] of held) {
        glows.set(pitch, pressGlow(heldMs));
    }
    return glows;
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
    keyColors,
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
    const cfg: ChromeConfig = {
        title,
        credit,
        width,
        height,
        unit,
        margin,
        durationMs,
        showTitle,
        showWordmark,
    };
    const keyLayout: KeyLayout = {
        margin,
        width,
        keyboardTop,
        keyboardHeight,
        white: keyColors?.white ?? WHITE_KEY,
        black: keyColors?.black ?? BLACK_KEY,
    };

    return (context, timeMs) => {
        const frame = frameAt(notes, timeMs);
        paintChrome(context, cfg, timeMs);

        if (score) {
            drawScore(context, score, frame.currentOnsetMs, timeMs);
        }

        if (scoreOnly) {
            paintCredit(context, cfg);
            return;
        }

        // White keys first so the black keys straddle on top; sounding keys lit
        // by the freshest press of their pitch, so a re-press during a long hold
        // still snaps back to full.
        const glows = keyGlows(frame.down);
        const glowOf = (pitch: number) => glows.get(pitch) ?? null;
        for (const key of keys.filter((entry) => !entry.black)) {
            paintKey(context, key, glowOf(key.pitch), keyLayout);
        }
        for (const key of keys.filter((entry) => entry.black)) {
            paintKey(context, key, glowOf(key.pitch), keyLayout);
        }

        paintCredit(context, cfg);
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

// A deep-to-accent block colour so a note reads as descending "into" the strike
// line, brightening as it lands.
const HIGHWAY_FAR = "#3730a3";
// How far ahead (ms on the notes' clock) a note first appears at the top of the
// fall region before it lands on the keys.
const HIGHWAY_WINDOW_MS = 2_500;

// The notes-highway video: falling blocks descend their key's lane and land on
// the lit keyboard at the moment they sound — the video twin of the on-screen
// highway, but time-based (a take carries every note's onset and duration, so a
// block falls in real time and its height is the note's real length). No staff;
// the keyboard sits at the foot with the blocks above it. The take records no
// hand, so blocks share one accent colour rather than the on-screen two.
export function takeHighwayPainter({
    title,
    credit,
    notes,
    durationMs,
    width,
    height,
    showTitle = true,
    showWordmark = true,
    keyColors,
}: {
    title: string;
    credit: string;
    notes: RecordedNote[];
    durationMs: number;
    width: number;
    height: number;
    showTitle?: boolean;
    showWordmark?: boolean;
    keyColors?: { white: string; black: string };
}): (context: Context2D, timeMs: number) => void {
    const { from, to } = sceneRange(notes.map((note) => note.pitch));
    const keys = sceneKeys(from, to);
    const margin = Math.round(width * 0.05);
    const unit = Math.min(width, height);
    // The keyboard sits at the foot; the blocks fall through the band above it,
    // from just below the title down to the keys' top (the strike line).
    const keyboardTop = height * 0.72;
    const keyboardHeight = height * 0.24;
    const laneTop = height * 0.3;
    const regionHeight = keyboardTop - laneTop;
    const cfg: ChromeConfig = {
        title,
        credit,
        width,
        height,
        unit,
        margin,
        durationMs,
        showTitle,
        showWordmark,
    };
    const keyLayout: KeyLayout = {
        margin,
        width,
        keyboardTop,
        keyboardHeight,
        white: keyColors?.white ?? WHITE_KEY,
        black: keyColors?.black ?? BLACK_KEY,
    };

    return (context, timeMs) => {
        const frame = frameAt(notes, timeMs);
        const clock = timeMs - LEAD_IN_MS;
        paintChrome(context, cfg, timeMs);

        // The falling blocks: each note's lane, top at its far (end) edge, bottom
        // at its onset edge clamped to the strike line, brightening as it lands.
        for (const block of highwayBlocks(notes, keys, clock, HIGHWAY_WINDOW_MS)) {
            const x = margin + block.x * (width - margin * 2);
            const w = block.width * (width - margin * 2);
            const top = keyboardTop - Math.min(1, block.endFrac) * regionHeight;
            const bottom = keyboardTop - Math.max(0, block.onsetFrac) * regionHeight;
            const nearness = Math.max(0, Math.min(1, 1 - block.onsetFrac));
            context.fillStyle = mixHex(HIGHWAY_FAR, ACCENT, nearness);
            context.beginPath();
            context.roundRect(x + w * 0.04, top, w * 0.92, Math.max(2, bottom - top), 4);
            context.fill();
        }

        // The strike line where blocks meet the keys.
        context.fillStyle = "#334155";
        context.fillRect(margin, keyboardTop - 2, width - margin * 2, 2);

        // The keyboard, sounding keys lit by their freshest press.
        const glows = keyGlows(frame.down);
        const glowOf = (pitch: number) => glows.get(pitch) ?? null;
        for (const key of keys.filter((entry) => !entry.black)) {
            paintKey(context, key, glowOf(key.pitch), keyLayout);
        }
        for (const key of keys.filter((entry) => entry.black)) {
            paintKey(context, key, glowOf(key.pitch), keyLayout);
        }

        paintCredit(context, cfg);
    };
}
