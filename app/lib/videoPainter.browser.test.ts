// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import interLatin from "@fontsource-variable/inter/files/inter-latin-wght-normal.woff2?url";
import { beforeAll, describe, expect, it } from "vitest";
import { LEAD_IN_MS } from "../../core/videoFrames";
import { BACKGROUND, FONT_FAMILY, takeHighwayPainter, takeScenePainter } from "./videoPainter";

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
const ACCENT = [0xaa, 0x36, 0xfc];
// The flat stage fill. Regions are measured as "anything that is not the ground",
// which stays true however light or dark the brand's stage colour is — a brightness
// cutoff only worked while the ground happened to be near-black.
// Read from the painter rather than written down again. A second copy of a colour goes
// stale the day the first one moves — which is exactly what happened when the stage went
// black and this still said violet, so every pixel in the frame counted as ink.
const GROUND = [
    Number.parseInt(BACKGROUND.slice(1, 3), 16),
    Number.parseInt(BACKGROUND.slice(3, 5), 16),
    Number.parseInt(BACKGROUND.slice(5, 7), 16),
];
function isGround(data: Uint8ClampedArray, i: number, tolerance = 8): boolean {
    return (
        Math.abs(data[i]! - GROUND[0]!) <= tolerance &&
        Math.abs(data[i + 1]! - GROUND[1]!) <= tolerance &&
        Math.abs(data[i + 2]! - GROUND[2]!) <= tolerance
    );
}

// Pixels close to the accent — a lit key decays away from the pure accent
// while held, so closeness (not equality) is what "lit" means.
// Pixels close to the accent. The tolerance is a parameter because two different questions
// are asked of it: whether one exact thing was painted, and whether a shaded key is lit.
// Wide enough to count a shaded key as lit, narrow enough that the ground and the ink are
// nowhere near it.
const LIT_TOLERANCE = 48;

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

// The exporter paints into a canvas owned by the running app, where the app's
// face is already registered; a bare test document has no faces at all, so
// register the same one the app ships to reproduce those conditions.
describe("the burnt-in text", () => {
    beforeAll(async () => {
        const face = new FontFace("Inter Variable", `url(${interLatin})`);
        await face.load();
        document.fonts.add(face);
    });

    // A canvas silently falls through to the next family when the one it names
    // is not registered, which would tie exported text to whatever the
    // recording machine has installed. Measuring is how that shows: if the
    // painter's family resolves, its metrics differ from the bare fallback.
    it("draws in the app's own face rather than falling back to the system one", () => {
        const context = new OffscreenCanvas(WIDTH, HEIGHT).getContext("2d")!;
        const measure = (family: string) => {
            context.font = `500 40px ${family}`;
            return context.measureText("plinky.fun").width;
        };

        expect(document.fonts.check(`500 40px "Inter Variable"`)).toBe(true);
        expect(measure(FONT_FAMILY)).not.toBeCloseTo(measure("system-ui, sans-serif"), 1);
    });
});

describe("takeScenePainter", () => {
    it("lights a key while its note sounds and rests it after", () => {
        // Both frames carry accent pixels from the progress rail; the sounding
        // key adds a key-sized block on top.
        // A lit key is no longer one flat block of accent: it carries a sheen at the top
        // and a shade toward its front lip, because a key filled flat reads as a stripe
        // rather than a solid. So the question here is "is this key lit", which is a band
        // around the accent — not "is this pixel exactly the accent", which was measuring
        // the fill.
        const during = countAccentPixels(paintAt(LEAD_IN_MS + 40), LIT_TOLERANCE);
        const after = countAccentPixels(paintAt(LEAD_IN_MS + 1_700), LIT_TOLERANCE);
        expect(during).toBeGreaterThan(after + 500);
    });

    it("fades a held press and re-lights it in full on the re-press", () => {
        // A fresh press paints a key-sized block of near-accent pixels; late in
        // the hold the key has decayed away from the accent, and the re-press
        // at 2000ms snaps it back.
        const fresh = countAccentPixels(paintAt(LEAD_IN_MS + 40), LIT_TOLERANCE);
        const faded = countAccentPixels(paintAt(LEAD_IN_MS + 1_300), LIT_TOLERANCE);
        const repressed = countAccentPixels(paintAt(LEAD_IN_MS + 2_040), LIT_TOLERANCE);
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
            // Anything that is not the flat background fill is ink.
            if (!isGround(data, i)) {
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
    // The licence sits on a third line, below the band the title and wordmark share and
    // clear of the progress rail at 0.26 — a strip holding that line and nothing else, so
    // what it counts is the licence rather than the furniture around it.
    const licenseRegion = (c: OffscreenCanvasRenderingContext2D) =>
        countPainted(c, 0, Math.round(HEIGHT * 0.205), half, Math.round(HEIGHT * 0.05));

    function paint(opts: {
        showTitle?: boolean;
        showWordmark?: boolean;
        license?: { name: string; mark: boolean };
    }) {
        const canvas = new OffscreenCanvas(WIDTH, HEIGHT);
        const context = canvas.getContext("2d")!;
        takeScenePainter({
            title: "Menuet",
            credit: "J. S. Bach · CC0",
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

        // Title off: the credit takes its place on the left — smaller type on one line
        // where there were two — and the wordmark stays. The band never empties, because
        // the credit is the piece's attribution and has to be somewhere.
        const noTitle = paint({ showTitle: false });
        expect(titleRegion(noTitle)).toBeGreaterThan(30);
        expect(titleRegion(noTitle)).toBeLessThan(titleRegion(both));
        expect(wordmarkRegion(noTitle)).toBeGreaterThan(30);

        // Watermark off: the right header goes blank, the title stays.
        const noMark = paint({ showWordmark: false });
        expect(wordmarkRegion(noMark)).toBe(0);
        expect(titleRegion(noMark)).toBeGreaterThan(30);
    });

    it("gives the licence a line of its own, and none when there is no licence", () => {
        // The licence sits under the composer, so the header band is taller with one than
        // without. Counting painted pixels is the only thing a canvas will tell you, and
        // more of them is exactly what a third line means.
        const withLicense = paint({
            license: { name: "CC0 1.0 Universal Public Domain Dedication", mark: true },
        });
        expect(licenseRegion(withLicense)).toBeGreaterThan(30);
        expect(licenseRegion(paint({}))).toBe(0);
    });

    it("draws the Creative Commons ring only when the licence is theirs", () => {
        // Same words either way, so any difference in the band is the mark itself.
        const marked = paint({ license: { name: "A Licence 1.0", mark: true } });
        const plain = paint({ license: { name: "A Licence 1.0", mark: false } });
        expect(licenseRegion(marked)).toBeGreaterThan(licenseRegion(plain));
    });

    it("keeps the provenance credit even with both header labels off", () => {
        // The catalogue is credit-required, so the credit survives whatever else is turned
        // off. It sits under the title rather than along the foot: at the foot it landed
        // either on the white keys or in the path of the falling notes, and a credit a
        // bar is crossing is not one anybody can read.
        const context = paint({ showTitle: false, showWordmark: false });
        expect(titleRegion(context)).toBeGreaterThan(30);
        // And the foot is clear, which is the half of the move that matters.
        const bottom = Math.round(HEIGHT * 0.9);
        expect(countPainted(context, 0, bottom, WIDTH, HEIGHT - bottom)).toBe(0);
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
            credit: "J. S. Bach · CC0",
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
                credit: "J. S. Bach · CC0",
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
                credit: "J. S. Bach · CC0",
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

describe("takeHighwayPainter", () => {
    const paintHighwayAt = (timeMs: number): OffscreenCanvasRenderingContext2D => {
        const canvas = new OffscreenCanvas(WIDTH, HEIGHT);
        const context = canvas.getContext("2d")!;
        takeHighwayPainter({
            title: "Menuet",
            credit: "J. S. Bach · CC0",
            notes: NOTES,
            durationMs: LEAD_IN_MS + 4_000,
            width: WIDTH,
            height: HEIGHT,
        })(context, timeMs);
        return context;
    };

    // Painted (non-background) pixels in the fall region between the title and
    // the keys (0.3H..0.72H) — the falling blocks live here.
    const fallRegion = (context: OffscreenCanvasRenderingContext2D): number => {
        const top = Math.round(HEIGHT * 0.32);
        const { data } = context.getImageData(0, top, WIDTH, Math.round(HEIGHT * 0.36));
        let painted = 0;
        for (let i = 0; i < data.length; i += 4) {
            if (!isGround(data, i)) {
                painted++;
            }
        }
        return painted;
    };

    it("shows a falling block while a note approaches, and clears it once past", () => {
        // The first note lands at LEAD_IN_MS; 500ms before, its block is falling.
        const approaching = fallRegion(paintHighwayAt(LEAD_IN_MS - 500));
        // By 3000ms after the notes' clock start both notes have passed the keys.
        const empty = fallRegion(paintHighwayAt(LEAD_IN_MS + 3_000));
        expect(approaching).toBeGreaterThan(empty + 500);
    });

    it("lights the key when its note lands on the strike line", () => {
        const during = countAccentPixels(paintHighwayAt(LEAD_IN_MS + 40));
        const silent = countAccentPixels(paintHighwayAt(LEAD_IN_MS + 1_700));
        expect(during).toBeGreaterThan(silent + 300);
    });
});
