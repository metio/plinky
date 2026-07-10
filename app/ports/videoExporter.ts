// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// The video-file seam. The hooks that decide WHAT a frame shows (the scene
// painter) and what it sounds like (the offline audio render) stay free of
// codecs and containers; the exporter turns their output into a shareable
// file. Kept behind a port because encoding support is genuinely uneven across
// engines — the UI asks supported() and simply doesn't offer the feature where
// the answer is no.

import type { RecordedNote } from "../../core/composition";

export type VideoExportInput = {
    width: number;
    height: number;
    fps: number;
    durationMs: number;
    // Paint the frame at timeMs (video clock, 0 = first frame) into the given
    // context. Called once per frame in order, so a painter may keep caches.
    paint(context: OffscreenCanvasRenderingContext2D, timeMs: number): void;
    // The performance to sound: the exporter renders the soundtrack itself
    // (offline, with the live synth's voice) so callers stay free of audio
    // machinery.
    notes: RecordedNote[];
};

export interface VideoExporter {
    // Whether this engine can produce the file at all (checked against the
    // actual encoder configurations, not just API presence).
    supported(): Promise<boolean>;
    // Encode the whole video and hand back the finished file. onProgress
    // reports 0..1 as frames are encoded, for a progress bar.
    export(input: VideoExportInput, onProgress?: (fraction: number) => void): Promise<Blob>;
}
