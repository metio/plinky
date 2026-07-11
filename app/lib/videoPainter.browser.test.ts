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
