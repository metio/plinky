// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it } from "vitest";
import { LEAD_IN_MS } from "../../core/videoFrames";
import { takeScenePainter } from "./videoPainter";

const WIDTH = 640;
const HEIGHT = 360;

function paintAt(timeMs: number): OffscreenCanvasRenderingContext2D {
    const canvas = new OffscreenCanvas(WIDTH, HEIGHT);
    const context = canvas.getContext("2d")!;
    const paint = takeScenePainter({
        title: "Menuet",
        credit: "Menuet · J. S. Bach · CC0",
        notes: [{ pitch: 60, startMs: 0, durationMs: 500, velocity: 100 }],
        durationMs: LEAD_IN_MS + 2_000,
        width: WIDTH,
        height: HEIGHT,
    });
    paint(context, timeMs);
    return context;
}

// The accent the painter lights sounding keys with, as raw RGB.
const ACCENT = [0x63, 0x66, 0xf1];

function countAccentPixels(context: OffscreenCanvasRenderingContext2D): number {
    const { data } = context.getImageData(0, 0, WIDTH, HEIGHT);
    let count = 0;
    for (let i = 0; i < data.length; i += 4) {
        if (data[i] === ACCENT[0] && data[i + 1] === ACCENT[1] && data[i + 2] === ACCENT[2]) {
            count++;
        }
    }
    return count;
}

describe("takeScenePainter", () => {
    it("lights a key while its note sounds and rests it after", () => {
        // Both frames carry accent pixels from the progress rail; the sounding
        // key adds a key-sized block on top.
        const during = countAccentPixels(paintAt(LEAD_IN_MS + 100));
        const after = countAccentPixels(paintAt(LEAD_IN_MS + 900));
        expect(during).toBeGreaterThan(after + 500);
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
