// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it } from "vitest";
import { LEAD_IN_MS } from "../../core/videoFrames";
import { takeScenePainter } from "./videoPainter";

const WIDTH = 640;
const HEIGHT = 360;

const NOTES = [
    // A long-held middle C, re-pressed after it ends.
    { pitch: 60, startMs: 0, durationMs: 1_400, velocity: 100 },
    { pitch: 60, startMs: 2_000, durationMs: 500, velocity: 100 },
];

function paintAt(timeMs: number): OffscreenCanvasRenderingContext2D {
    const canvas = new OffscreenCanvas(WIDTH, HEIGHT);
    const context = canvas.getContext("2d")!;
    const paint = takeScenePainter({
        title: "Menuet",
        credit: "Menuet · J. S. Bach · CC0",
        notes: NOTES,
        durationMs: LEAD_IN_MS + 4_000,
        width: WIDTH,
        height: HEIGHT,
    });
    paint(context, timeMs);
    return context;
}

// The accent the painter lights sounding keys with, as raw RGB.
const ACCENT = [0x63, 0x66, 0xf1];

// Pixels close to the accent — a lit key decays away from the pure accent
// while held, so closeness (not equality) is what "lit" means.
function countAccentPixels(context: OffscreenCanvasRenderingContext2D, tolerance = 8): number {
    const { data } = context.getImageData(0, 0, WIDTH, HEIGHT);
    let count = 0;
    for (let i = 0; i < data.length; i += 4) {
        if (
            Math.abs(data[i]! - ACCENT[0]!) <= tolerance &&
            Math.abs(data[i + 1]! - ACCENT[1]!) <= tolerance &&
            Math.abs(data[i + 2]! - ACCENT[2]!) <= tolerance
        ) {
            count++;
        }
    }
    return count;
}

describe("takeScenePainter", () => {
    it("lights a key while its note sounds and rests it after", () => {
        // Both frames carry accent pixels from the progress rail; the sounding
        // key adds a key-sized block on top.
        const during = countAccentPixels(paintAt(LEAD_IN_MS + 40));
        const after = countAccentPixels(paintAt(LEAD_IN_MS + 1_700));
        expect(during).toBeGreaterThan(after + 500);
    });

    it("fades a held press and re-lights it in full on the re-press", () => {
        // A fresh press paints a key-sized block of near-accent pixels; late in
        // the hold the key has decayed away from the accent, and the re-press
        // at 2000ms snaps it back.
        const fresh = countAccentPixels(paintAt(LEAD_IN_MS + 40));
        const faded = countAccentPixels(paintAt(LEAD_IN_MS + 1_300));
        const repressed = countAccentPixels(paintAt(LEAD_IN_MS + 2_040));
        expect(fresh).toBeGreaterThan(faded + 500);
        expect(repressed).toBeGreaterThan(faded + 500);
    });

    it("covers the whole frame — no unpainted pixels leak previous frames", () => {
        const context = paintAt(0);
        const { data } = context.getImageData(0, 0, WIDTH, HEIGHT);
        // Alpha is opaque everywhere: the painter owns every pixel.
        for (let i = 3; i < data.length; i += 4 * 997) {
            expect(data[i]).toBe(255);
        }
    });
});

describe("takeScenePainter title and watermark toggles", () => {
    // Count painted (non-background) pixels in a region — font-render-independent,
    // unlike matching a specific text colour, which anti-aliasing thins out
    // differently on each browser's font stack.
    function countPainted(
        context: OffscreenCanvasRenderingContext2D,
        x: number,
        y: number,
        w: number,
        h: number,
    ): number {
        const { data } = context.getImageData(x, y, w, h);
        let painted = 0;
        for (let i = 0; i < data.length; i += 4) {
            // Anything meaningfully lighter than the #0b0f1a background is ink.
            if (data[i]! > 0x40 || data[i + 1]! > 0x40 || data[i + 2]! > 0x40) {
                painted++;
            }
        }
        return painted;
    }

    // The header band above the progress rail (rail sits at height*0.26): the
    // title is left-aligned, the wordmark right-aligned, so each owns a half.
    const bandTop = 0;
    const bandHeight = Math.round(HEIGHT * 0.2);
    const half = Math.round(WIDTH / 2);
    const titleRegion = (c: OffscreenCanvasRenderingContext2D) =>
        countPainted(c, 0, bandTop, half, bandHeight);
    const wordmarkRegion = (c: OffscreenCanvasRenderingContext2D) =>
        countPainted(c, half, bandTop, WIDTH - half, bandHeight);

    function paint(opts: { showTitle?: boolean; showWordmark?: boolean }) {
        const canvas = new OffscreenCanvas(WIDTH, HEIGHT);
        const context = canvas.getContext("2d")!;
        takeScenePainter({
            title: "Menuet",
            credit: "Menuet · J. S. Bach · CC0",
            notes: NOTES,
            durationMs: LEAD_IN_MS + 4_000,
            width: WIDTH,
            height: HEIGHT,
            ...opts,
        })(context, 0);
        return context;
    }

    it("burns in the title and wordmark by default, and drops each on demand", () => {
        const both = paint({});
        expect(titleRegion(both)).toBeGreaterThan(30);
        expect(wordmarkRegion(both)).toBeGreaterThan(30);

        // Title off: the left header goes blank, the wordmark stays.
        const noTitle = paint({ showTitle: false });
        expect(titleRegion(noTitle)).toBe(0);
        expect(wordmarkRegion(noTitle)).toBeGreaterThan(30);

        // Watermark off: the right header goes blank, the title stays.
        const noMark = paint({ showWordmark: false });
        expect(wordmarkRegion(noMark)).toBe(0);
        expect(titleRegion(noMark)).toBeGreaterThan(30);
    });

    it("keeps the provenance credit even with both header labels off", () => {
        // The catalogue is credit-required, so the bottom credit line survives
        // regardless — the bottom band still carries painted text.
        const context = paint({ showTitle: false, showWordmark: false });
        const bottom = Math.round(HEIGHT * 0.9);
        expect(countPainted(context, 0, bottom, WIDTH, HEIGHT - bottom)).toBeGreaterThan(30);
    });
});

describe("takeScenePainter with a score panel", () => {
    // A stand-in score image: a mid-grey sheet, so panel pixels are telling.
    const sheet = new OffscreenCanvas(800, 300);
    sheet.getContext("2d")!.fillStyle = "#808080";
    sheet.getContext("2d")!.fillRect(0, 0, 800, 300);
    const score = {
        image: sheet,
        width: 800,
        height: 300,
        steps: [[{ x: 100, y: 100, width: 30, height: 30 }]],
    };

    function paintWithScore(timeMs: number): OffscreenCanvasRenderingContext2D {
        const canvas = new OffscreenCanvas(WIDTH, HEIGHT);
        const context = canvas.getContext("2d")!;
        takeScenePainter({
            title: "Menuet",
            credit: "Menuet · J. S. Bach · CC0",
            notes: [{ pitch: 60, startMs: 0, durationMs: 400, velocity: 100 }],
            durationMs: LEAD_IN_MS + 2_000,
            width: WIDTH,
            height: HEIGHT,
            score,
        })(context, timeMs);
        return context;
    }

    function countGreyPixels(context: OffscreenCanvasRenderingContext2D): number {
        const { data } = context.getImageData(0, 0, WIDTH, HEIGHT);
        let count = 0;
        for (let i = 0; i < data.length; i += 4) {
            if (data[i] === 0x80 && data[i + 1] === 0x80 && data[i + 2] === 0x80) {
                count++;
            }
        }
        return count;
    }

    it("draws the score sheet into the panel", () => {
        expect(countGreyPixels(paintWithScore(0))).toBeGreaterThan(5_000);
    });

    it("hands the whole stage to the score when the keyboard is dropped by choice", () => {
        // Landscape, keyboard off: the score panel takes the keyboard's band too,
        // so the sheet paints far more pixels than the shared layout shows.
        const paintLayout = (keyboard: boolean) => {
            const canvas = new OffscreenCanvas(WIDTH, HEIGHT);
            const context = canvas.getContext("2d")!;
            takeScenePainter({
                title: "Menuet",
                credit: "Menuet · J. S. Bach · CC0",
                notes: [{ pitch: 60, startMs: 0, durationMs: 400, velocity: 100 }],
                durationMs: LEAD_IN_MS + 2_000,
                width: WIDTH,
                height: HEIGHT,
                score,
                keyboard,
            })(context, 0);
            return context;
        };
        const withKeys = countGreyPixels(paintLayout(true));
        const scoreOnly = countGreyPixels(paintLayout(false));
        expect(scoreOnly).toBeGreaterThan(withKeys * 1.5);
    });

    it("scrolls a treadmill sheet sideways as the music advances", () => {
        // A very wide, shallow sheet: only a horizontal window can show it. Two
        // steps, far apart in x — early in the piece the window sits at the
        // start, late it has slid toward the far step.
        const wide = new OffscreenCanvas(4000, 120);
        const wctx = wide.getContext("2d")!;
        wctx.fillStyle = "#808080";
        wctx.fillRect(0, 0, 4000, 120);
        // A distinct stripe near the far end, visible only once the window slides.
        wctx.fillStyle = "#404040";
        wctx.fillRect(3600, 0, 400, 120);
        // Sixteen evenly spaced steps: the window sizes itself to a phrase of
        // them, so the far stripe only enters once the music nears the end.
        const sheet = {
            image: wide,
            width: 4000,
            height: 120,
            steps: Array.from({ length: 16 }, (_, i) => [
                { x: 100 + i * 246, y: 40, width: 30, height: 30 },
            ]),
        };
        const notes = Array.from({ length: 16 }, (_, i) => ({
            pitch: 60,
            startMs: i * 200,
            durationMs: 150,
            velocity: 100,
        }));
        const paintTreadmill = (timeMs: number) => {
            const canvas = new OffscreenCanvas(WIDTH, HEIGHT);
            const context = canvas.getContext("2d")!;
            takeScenePainter({
                title: "Menuet",
                credit: "Menuet · J. S. Bach · CC0",
                notes,
                durationMs: LEAD_IN_MS + 16 * 200,
                width: WIDTH,
                height: HEIGHT,
                score: sheet,
                treadmill: true,
            })(context, timeMs);
            return context;
        };
        const countDark = (context: OffscreenCanvasRenderingContext2D) => {
            const { data } = context.getImageData(0, 0, WIDTH, HEIGHT);
            let count = 0;
            for (let i = 0; i < data.length; i += 4) {
                if (data[i] === 0x40 && data[i + 1] === 0x40 && data[i + 2] === 0x40) {
                    count++;
                }
            }
            return count;
        };
        // At the start the far stripe is out of the window; near the second
        // step's onset the window has slid and the stripe fills part of it.
        expect(countDark(paintTreadmill(0))).toBe(0);
        expect(countDark(paintTreadmill(LEAD_IN_MS + 15 * 200))).toBeGreaterThan(1_000);
    });

    it("tints the played step's noteheads once its onset passes", () => {
        // The tint blends accent over the grey sheet, eating grey pixels.
        const before = countGreyPixels(paintWithScore(0));
        const after = countGreyPixels(paintWithScore(LEAD_IN_MS + 100));
        expect(before).toBeGreaterThan(after + 100);
    });
});
