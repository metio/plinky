// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { afterEach, describe, expect, it, vi } from "vitest";
import type { VideoExportInput } from "../ports/videoExporter";

const INPUT: VideoExportInput = {
    width: 1280,
    height: 720,
    fps: 30,
    durationMs: 1_000,
    paint: () => {},
    notes: [],
};

// Each test picks what the lazily-imported chunk resolves to, so the module
// under test must be loaded fresh against that choice.
async function loadLazyVideo() {
    vi.resetModules();
    return (await import("./lazyVideo")).lazyVideoExporter;
}

afterEach(() => {
    vi.doUnmock("./webCodecsVideo");
    vi.resetModules();
});

describe("lazyVideoExporter", () => {
    it("answers with the real adapter's verdict once the chunk loads", async () => {
        vi.doMock("./webCodecsVideo", () => ({
            webCodecsVideoExporter: { supported: async () => true, export: async () => new Blob() },
        }));

        await expect((await loadLazyVideo()).supported()).resolves.toBe(true);
    });

    it("reports unsupported when the chunk cannot load", async () => {
        vi.doMock("./webCodecsVideo", () => {
            throw new Error("chunk unavailable");
        });

        await expect((await loadLazyVideo()).supported()).resolves.toBe(false);
    });

    it("hands the input and the progress callback straight to the real adapter", async () => {
        const blob = new Blob(["mp4"]);
        const exportSpy = vi.fn(async () => blob);
        vi.doMock("./webCodecsVideo", () => ({
            webCodecsVideoExporter: { supported: async () => true, export: exportSpy },
        }));
        const onProgress = () => {};

        await expect((await loadLazyVideo()).export(INPUT, onProgress)).resolves.toBe(blob);
        expect(exportSpy).toHaveBeenCalledWith(INPUT, onProgress);
    });

    // An export the user asked for that cannot even load its encoder is a
    // failure to report, not a silent empty file: only supported() answers
    // "no video here".
    it("propagates a chunk that cannot load out of export", async () => {
        vi.doMock("./webCodecsVideo", () => {
            throw new Error("chunk unavailable");
        });

        await expect((await loadLazyVideo()).export(INPUT)).rejects.toThrow();
    });
});
