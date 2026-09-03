// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import type { RecordedNote } from "../../core/composition";
import { videoDurationMs } from "../../core/videoFrames";
import { webAudioFileExporter } from "./webAudioFile";

// The unit tests prove the WAV bytes agree with themselves. Only a real decoder proves they
// are a file: a header can be perfectly self-consistent and still describe audio no player
// will open. So the export is handed back to the browser that will play it, and the browser
// is asked what it found.
//
// It runs in the browser project because everything under it is browser-only — the offline
// render, the encoder, the decoder — and there is no arrangement of fakes that would make
// this assertion mean anything.

const notes: RecordedNote[] = [
    { pitch: 60, startMs: 0, durationMs: 400, velocity: 90 },
    { pitch: 64, startMs: 400, durationMs: 400, velocity: 90 },
];

describe("the audio file a take exports", () => {
    it("decodes as real audio of the right length", async () => {
        const { blob, extension } = await webAudioFileExporter.export(notes);
        expect(["m4a", "wav"]).toContain(extension);
        expect(blob.size).toBeGreaterThan(0);

        const context = new AudioContext();
        const decoded = await context.decodeAudioData(await blob.arrayBuffer());
        await context.close();

        expect(decoded.numberOfChannels).toBe(2);
        // As long as the render says, which is the lead-in of stillness, the playing, and
        // the tail the notes ring out into — asked of videoDurationMs rather than counted
        // here, so this pins the export against the timeline and not against a number that
        // has to be kept in step with it by hand.
        //
        // Compared loosely on purpose: a compressed format pads to its own frame size, and
        // an exact length would pin the codec rather than the export.
        const expected = videoDurationMs(notes) / 1000;
        expect(decoded.duration).toBeGreaterThan(expected * 0.95);
        expect(decoded.duration).toBeLessThan(expected * 1.05 + 0.1);
    });

    it("carries the playing, not silence", async () => {
        const { blob } = await webAudioFileExporter.export(notes);
        const context = new AudioContext();
        const decoded = await context.decodeAudioData(await blob.arrayBuffer());
        await context.close();

        const samples = decoded.getChannelData(0);
        let peak = 0;
        for (let index = 0; index < samples.length; index++) {
            peak = Math.max(peak, Math.abs(samples[index] ?? 0));
        }
        // A file of the right length full of nothing is exactly what a wrong channel layout,
        // a wrongly sized data chunk or an unflushed encoder produces, and every other
        // assertion here passes on it.
        expect(peak).toBeGreaterThan(0.01);
    });

    it("gives an empty take a file rather than an error", async () => {
        // Nothing played is a thing a player can ask to export, and the lead-in means the
        // render still has a length. It should come back as a short silent file.
        const { blob } = await webAudioFileExporter.export([]);
        expect(blob.size).toBeGreaterThan(0);
    });
});
