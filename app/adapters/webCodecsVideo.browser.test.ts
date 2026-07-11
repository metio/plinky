// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it } from "vitest";
import { webCodecsVideoExporter } from "./webCodecsVideo";

// supported() is the seam the UI trusts: on an engine that reports false the
// export is simply never offered, and the test then has nothing further to
// verify. Where it reports true (chromium with AAC, firefox via the Opus
// fallback) the full export must produce a playable file.

describe("webCodecsVideoExporter", () => {
    it("answers supported() without throwing on any engine", async () => {
        expect(typeof (await webCodecsVideoExporter.supported())).toBe("boolean");
    });

    it("muxes painted frames and rendered audio into a streamable mp4", async () => {
        if (!(await webCodecsVideoExporter.supported())) {
            return;
        }
        const progress: number[] = [];
        const blob = await webCodecsVideoExporter.export(
            {
                width: 320,
                height: 180,
                fps: 10,
                durationMs: 1_200,
                paint(context, timeMs) {
                    context.fillStyle = "#111827";
                    context.fillRect(0, 0, 320, 180);
                    context.fillStyle = "#6366f1";
                    context.fillRect((timeMs / 1_200) * 320, 60, 40, 60);
                },
                notes: [{ pitch: 60, startMs: 0, durationMs: 300, velocity: 100 }],
            },
            (fraction) => progress.push(fraction),
        );
        expect(blob.type).toBe("video/mp4");
        // A real file, not a header: frames and sound take space.
        expect(blob.size).toBeGreaterThan(5_000);
        // fastStart puts the ftyp box first, so the file streams from byte 4.
        const head = new Uint8Array(await blob.slice(0, 8).arrayBuffer());
        expect(String.fromCharCode(...head.subarray(4, 8))).toBe("ftyp");
        // Progress walked to completion.
        expect(progress.at(-1)).toBe(1);
        expect(progress.length).toBeGreaterThan(2);
    });
});
