// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { DEFAULT_THEME } from "../../core/keyboardTheme";
import type { RecordedNote } from "../../core/composition";
import {
    DEFAULT_KEYBOARD_DEPTH,
    DEFAULT_NOTE_COLOR,
    fingerColorHex,
    handColorHex,
    notePaint,
    keyboardDepthFraction,
} from "../../core/videoLook";
import { frameAt, LEAD_IN_MS, pressGlow } from "../../core/videoFrames";
import {
    highwayBlocks,
    playedStepCount,
    type SceneKey,
    keyboardHeightFor,
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

// The stage palette, taken from the logo so an exported file looks like the app — on a
// black ground, which is a decision about the notes rather than about the stage.
//
// The notes are coloured by finger: warm red, orange, sunny yellow, pink and violet. Those
// were fighting the deep violet they sat on, which is a near neighbour of two of them, and
// a ground that competes with the thing it carries makes the thing quieter. Black takes
// nothing from them and is what a video is expected to letterbox into anyway.
//
// Contrast only improves: measured against the old ground (relative luminance 0.041) INK
// was 11.0:1 and MUTED 6.8:1, and black is darker than that, so both climb.
export const BACKGROUND = "#000000";
const INK = "#F9F8FC";
const MUTED = "#EDB2FD";
const ACCENT = "#AA36FC";

// The keys a caller draws when it names no theme of its own.
//
// This used to be a pair of constants defined here, and they were not the colours any
// keyboard in the app is painted in. The export panel passes the player's chosen theme and
// never saw them; the promo renderer passes nothing and saw only them, so every promo clip
// was keyed in a palette that exists nowhere else — the one visible difference between two
// videos drawn by the same painter through the same encoder. Reading the app's default
// theme instead makes "the same graphics" true by construction rather than by inspection.
const DEFAULT_KEYS = { white: DEFAULT_THEME.whiteHex, black: DEFAULT_THEME.blackHex };

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
    // The keys are shaded rather than filled flat, which is what stops a long one reading
    // as a stripe. Narrow on purpose, this list — every entry is something a stand-in
    // context in a test has to answer.
    | "createLinearGradient"
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
    // The rail's unfilled track: the violet-black, a step down from the ground
    // (1.5:1) so it reads as a groove, with the accent-filled part at 3.8:1 on it.
    context.fillStyle = "#191545";
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

// A white key's width in pixels — what the key-shape band is judged against. Read off the
// laid-out keys rather than recomputed, so it cannot disagree with what is drawn.
function whiteKeyWidth(keys: readonly SceneKey[], width: number, margin: number): number {
    const white = keys.find((key) => !key.black);
    return white ? white.width * (width - margin * 2) : 0;
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

// How much of a white key's height is its front face — the lip you see because a key is a
// solid thing lying down rather than a painted stripe. Small: a real one is a few
// millimetres of a long lever, and overdoing it turns a piano into a cartoon.
const KEY_LIP = 0.09;
// How far the top of a key is lifted toward white, and the bottom dropped toward its own
// shadow. A single flat fill reads as a rectangle at any size; at a deep keyboard, where
// the keys are longest, it reads as a stripe.
const KEY_SHEEN = 0.22;
const KEY_SHADE = 0.14;

// A sounding key is the resting colour blended toward the accent by its glow —
// full at the press, decaying while held — so a repeated press of the same key
// visibly re-lights it instead of merging into one long hold.
//
// Shaped rather than filled flat. A key is lit from above and has a front face, and those
// two facts are what stop a tall key from reading as a coloured stripe: a sheen down from
// the top, a shade toward the bottom, and a distinct lip across the front. It matters most
// exactly where the flat fill looked worst — the deeper the keyboard, the longer the key,
// and the more a single colour has to carry.
function paintKey(
    context: Context2D,
    key: SceneKey,
    glow: number | null,
    l: KeyLayout,
    lit: string = ACCENT,
): void {
    const x = l.margin + key.x * (l.width - l.margin * 2);
    const w = key.width * (l.width - l.margin * 2);
    const h = key.black ? l.keyboardHeight * 0.62 : l.keyboardHeight;
    const rest = key.black ? l.black : l.white;
    const base = glow === null ? rest : mixHex(rest, lit, glow);

    const face = context.createLinearGradient(0, l.keyboardTop, 0, l.keyboardTop + h);
    face.addColorStop(0, mixHex(base, "#FFFFFF", KEY_SHEEN));
    face.addColorStop(key.black ? 0.7 : 0.55, base);
    face.addColorStop(1, mixHex(base, "#000000", KEY_SHADE));
    context.fillStyle = face;
    context.beginPath();
    context.roundRect(x + w * 0.04, l.keyboardTop, w * 0.92, h, 4);
    context.fill();

    // The front face, darker than the key it belongs to, so the eye reads a solid with a
    // near edge. Only the white keys carry it: a black key is already the dark thing.
    if (!key.black) {
        context.fillStyle = mixHex(base, "#000000", KEY_SHADE * 2.4);
        context.beginPath();
        context.roundRect(
            x + w * 0.04,
            l.keyboardTop + h * (1 - KEY_LIP),
            w * 0.92,
            h * KEY_LIP,
            [0, 0, 4, 4],
        );
        context.fill();
    }
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

// The keys, white ones first and black ones over them.
//
// The order is the whole reason this is a function rather than one loop: a black key
// overlaps the two white keys it sits between, so drawing them in pitch order would leave
// the white neighbours painted on top of it. Both painters need that, and only one of them
// tints a lit key by finger or hand.
function paintKeyboard(
    context: Context2D,
    keys: SceneKey[],
    layout: KeyLayout,
    glowOf: (pitch: number) => number | null,
    litOf?: (pitch: number) => string,
): void {
    for (const key of keys.filter((entry) => !entry.black)) {
        paintKey(context, key, glowOf(key.pitch), layout, litOf?.(key.pitch));
    }
    for (const key of keys.filter((entry) => entry.black)) {
        paintKey(context, key, glowOf(key.pitch), layout, litOf?.(key.pitch));
    }
}

// The stage both painters set before they draw anything: the pitch range the run spans and
// its keys, the margin and the type unit, and the chrome the frame wears.
//
// The type unit is the SMALLER side rather than the width, and that is the part worth having
// in one place: a portrait frame is taller than wide, so scaling type by width would turn
// its titles into billboards.
function stageFor(input: {
    title: string;
    credit: string;
    notes: RecordedNote[];
    durationMs: number;
    width: number;
    height: number;
    showTitle: boolean;
    showWordmark: boolean;
}): {
    from: number;
    to: number;
    keys: SceneKey[];
    margin: number;
    unit: number;
    cfg: ChromeConfig;
} {
    const { from, to } = sceneRange(input.notes.map((note) => note.pitch));
    const margin = Math.round(input.width * 0.05);
    const unit = Math.min(input.width, input.height);
    return {
        from,
        to,
        keys: sceneKeys(from, to),
        margin,
        unit,
        cfg: {
            title: input.title,
            credit: input.credit,
            width: input.width,
            height: input.height,
            unit,
            margin,
            durationMs: input.durationMs,
            showTitle: input.showTitle,
            showWordmark: input.showWordmark,
        },
    };
}

// Where the keys sit and what colour they are. Each painter decides the band; everything
// else about it is the same picture.
function keyLayoutFor(
    width: number,
    margin: number,
    keyboardTop: number,
    keyboardHeight: number,
    keyColors?: { white: string; black: string },
): KeyLayout {
    return {
        margin,
        width,
        keyboardTop,
        keyboardHeight,
        white: keyColors?.white ?? DEFAULT_KEYS.white,
        black: keyColors?.black ?? DEFAULT_KEYS.black,
    };
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
    const { keys, margin, unit, cfg } = stageFor({
        title,
        credit,
        notes,
        durationMs,
        width,
        height,
        showTitle,
        showWordmark,
    });
    // With a notation panel the keyboard cedes the middle of the stage to it.
    // A portrait frame drops the keyboard entirely (on the vertical feeds the
    // notation is the story, and the full-height panel keeps its glyphs readable
    // on a phone), and the exporter can drop it by choice — but only when a
    // score exists to fill the stage instead.
    const scoreOnly = score !== null && (height > width || !keyboard);
    // The depth this layout wants, held to a key a piano could have (core/videoScene).
    const keyboardHeight = keyboardHeightFor(
        score ? height * 0.24 : height * 0.4,
        whiteKeyWidth(keys, width, margin),
    );
    // The keys keep the floor they always stood on and grow upward from it, the way the
    // highway's do. Anchoring the top instead would push a keyboard the band has made
    // taller straight off the bottom of the frame, over the credit line.
    const keyboardBottom = score ? height * 0.9 : height * 0.82;
    const keyboardTop = keyboardBottom - keyboardHeight;
    // The run's distinct onsets in playing order — step i of the snapshot sounded
    // at onsets[i], mirroring how the matcher and the take both count steps.
    const onsets = [...new Set(notes.map((note) => note.startMs))].sort((a, b) => a - b);
    const keyLayout = keyLayoutFor(width, margin, keyboardTop, keyboardHeight, keyColors);

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
        paintKeyboard(context, keys, keyLayout, glowOf);

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

// What one note is painted, given the scheme the person making the video chose. The
// decision itself is in core and shared with the practice highway; this only turns the
// answer into the hex a canvas wants.
function paintHex(
    scheme: string,
    note: { finger?: number; hand?: "left" | "right" },
    fallback: string,
): string {
    const paint = notePaint(scheme, note);
    if (paint.kind === "finger") {
        return fingerColorHex(paint.finger, fallback);
    }
    if (paint.kind === "hand") {
        return handColorHex(paint.hand, fallback);
    }
    return fallback;
}

// A deep-to-accent block colour so a note reads as descending "into" the strike line,
// brightening as it lands. The far end is the note colour darkened toward black rather
// than a second constant, so a caller that sets its own accent gets the same descent.
const HIGHWAY_FAR = "#191545";
function farOf(accent: string): string {
    return accent === ACCENT ? HIGHWAY_FAR : mixHex("#000000", accent, 0.45);
}
// How far ahead (ms on the notes' clock) a note first appears at the top of the
// fall region before it lands on the keys.
const HIGHWAY_WINDOW_MS = 2_500;

// The notes-highway video: falling blocks descend their key's lane and land on
// the lit keyboard at the moment they sound — the video twin of the on-screen
// highway, but time-based (a take carries every note's onset and duration, so a
// block falls in real time and its height is the note's real length). No staff;
// the keyboard sits at the foot with the blocks above it. The take records no
// hand unless a score put one there, so blocks share one accent colour — except when
// colouring by finger, where the fingering the performance carries decides each note.
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
    accent = ACCENT,
    scheme = DEFAULT_NOTE_COLOR,
    keyboardDepth = keyboardDepthFraction(DEFAULT_KEYBOARD_DEPTH),
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
    // The colour a falling note lands in. Defaults to the app's accent, which is what an
    // exported take uses; a caller rendering for somewhere else can set its own. Only the
    // blocks follow it — the lit key, the progress bar and the chrome keep the accent,
    // since those carry meaning rather than decoration.
    accent?: string;
    // Colour each note by the finger that plays it instead of by one accent — falling
    // block and lit key alike, so the two agree. Notes the performance did not finger
    // keep the accent.
    // How a falling note is coloured: a flat colour, by the finger that plays it, or by
    // the hand. One of `HIGHWAY_SCHEMES` — the same list the practice highway offers, so
    // the two pictures cannot drift apart in what they can be made to look like.
    scheme?: string;
    // How much of the frame's height the keyboard takes; see core/videoLook.
    keyboardDepth?: number;
}): (context: Context2D, timeMs: number) => void {
    const { keys, margin, cfg } = stageFor({
        title,
        credit,
        notes,
        durationMs,
        width,
        height,
        showTitle,
        showWordmark,
    });
    // The keyboard sits at the foot; the blocks fall through the band above it,
    // from just below the title down to the keys' top (the strike line).
    //
    // The keys sit on the floor of the frame whatever depth is chosen, so a deeper
    // keyboard grows upward into the fall region rather than hanging in mid-air.
    const keyboardHeight = keyboardHeightFor(
        height * keyboardDepth,
        whiteKeyWidth(keys, width, margin),
    );
    const keyboardTop = height * 0.96 - keyboardHeight;
    const laneTop = height * 0.3;
    const regionHeight = keyboardTop - laneTop;
    const keyLayout = keyLayoutFor(width, margin, keyboardTop, keyboardHeight, keyColors);

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
            const near = paintHex(scheme, block, accent);
            context.fillStyle = mixHex(farOf(near), near, nearness);
            context.beginPath();
            context.roundRect(x + w * 0.04, top, w * 0.92, Math.max(2, bottom - top), 4);
            context.fill();
        }

        // The strike line where blocks meet the keys.
        // Pale plink, 6.8:1 on the ground, so the landing line stays crisp.
        context.fillStyle = "#EDB2FD";
        context.fillRect(margin, keyboardTop - 2, width - margin * 2, 2);

        // The keyboard, sounding keys lit by their freshest press.
        const glows = keyGlows(frame.down);
        const glowOf = (pitch: number) => glows.get(pitch) ?? null;
        // The finger and the hand sounding each key right now, so a lit key matches the
        // colour of the block that just landed on it whichever scheme is chosen.
        const fingers = new Map(frame.down.map((entry) => [entry.pitch, entry.finger]));
        const hands = new Map(frame.down.map((entry) => [entry.pitch, entry.hand]));
        const litOf = (pitch: number) =>
            paintHex(scheme, { finger: fingers.get(pitch), hand: hands.get(pitch) }, ACCENT);
        paintKeyboard(context, keys, keyLayout, glowOf, litOf);

        paintCredit(context, cfg);
    };
}
