// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { VideoExporter, VideoExportInput } from "../ports/videoExporter";

// The composition root's video capability: a thin shell that pulls the real
// WebCodecs adapter (and its muxer dependency) in on first use, so the encode
// machinery never rides in the eager bundle — exporting a video is a rare,
// deliberate act, and the bundle budget is a per-visitor cost.
export const lazyVideoExporter: VideoExporter = {
    async supported(): Promise<boolean> {
        // A chunk that can't load (an offline moment, a torn-down test
        // environment) means "no video here", never an unhandled rejection.
        try {
            const { webCodecsVideoExporter } = await import("./webCodecsVideo");
            return webCodecsVideoExporter.supported();
        } catch {
            return false;
        }
    },
    async export(input: VideoExportInput, onProgress?: (fraction: number) => void): Promise<Blob> {
        const { webCodecsVideoExporter } = await import("./webCodecsVideo");
        return webCodecsVideoExporter.export(input, onProgress);
    },
};
