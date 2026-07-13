// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it } from "vitest";
import type { RecordedNote } from "../../core/composition";
import { LEAD_IN_MS, TAIL_MS, videoDurationMs } from "../../core/videoFrames";
import { renderTakeAudio } from "./offlineAudio";

const note = (startMs: number, pitch = 60, velocity = 100, durationMs = 400): RecordedNote => ({
    pitch,
    startMs,
    durationMs,
    velocity,
});

// Peak absolute sample level over a slice of the buffer, across channels.
function peak(buffer: AudioBuffer, fromS: number, toS: number): number {
    let max = 0;
    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
        const data = buffer.getChannelData(channel);
        const from = Math.floor(fromS * buffer.sampleRate);
        const to = Math.min(data.length, Math.ceil(toS * buffer.sampleRate));
        for (let i = from; i < to; i++) {
            max = Math.max(max, Math.abs(data[i]!));
        }
    }
    return max;
}

describe("renderTakeAudio", () => {
    it("renders the take's span with sound at the notes and silence around them", async () => {
        const notes = [note(0), note(600, 64)];
        const buffer = await renderTakeAudio(notes, 24_000);
        expect(buffer.duration).toBeCloseTo(videoDurationMs(notes) / 1000, 1);
        // The lead-in is still; the notes ring; the tail fades back to rest.
        expect(peak(buffer, 0, (LEAD_IN_MS - 50) / 1000)).toBe(0);
        expect(peak(buffer, LEAD_IN_MS / 1000, (LEAD_IN_MS + 400) / 1000)).toBeGreaterThan(0.01);
        const end = buffer.duration;
        expect(peak(buffer, end - (TAIL_MS - 500) / 1000, end)).toBeLessThan(0.01);
    });

    it("strikes harder for a higher velocity, like the live synth", async () => {
        const loud = await renderTakeAudio([note(0, 60, 120)], 24_000);
        const soft = await renderTakeAudio([note(0, 60, 30)], 24_000);
        const window = [LEAD_IN_MS / 1000, (LEAD_IN_MS + 300) / 1000] as const;
        expect(peak(loud, ...window)).toBeGreaterThan(peak(soft, ...window) * 2);
    });

    it("rings on past a note's notated length so neighbours overlap into legato", async () => {
        // A single 400 ms note starting at the note clock's zero: its notated end lands
        // LEAD_IN_MS + 400 into the buffer. The release tail keeps it sounding past that.
        const buffer = await renderTakeAudio([note(0)], 24_000);
        const notatedEnd = (LEAD_IN_MS + 400) / 1000;
        expect(peak(buffer, notatedEnd + 0.05, notatedEnd + 0.15)).toBeGreaterThan(0.01);
    });

    it("sustains a held bass note longer than a held treble note", async () => {
        // Long notes, so the register tail is the binding constraint (not the note's own
        // length): measured well past their shared notated end, only the bass rings on.
        const bass = await renderTakeAudio([note(0, 40, 100, 2000)], 24_000);
        const treble = await renderTakeAudio([note(0, 84, 100, 2000)], 24_000);
        const late = [(LEAD_IN_MS + 2000 + 500) / 1000, (LEAD_IN_MS + 2000 + 650) / 1000] as const;
        expect(peak(bass, ...late)).toBeGreaterThan(peak(treble, ...late));
    });

    it("clips a short note's ring so a staccato stays crisp", async () => {
        // Same pitch, one short (staccato) and one long (held). Measured the same distance
        // past each note's own notated end, only the held note is still ringing — the short
        // note's tail is capped to a crisp fraction of its length.
        const staccato = await renderTakeAudio([note(0, 60, 100, 80)], 24_000);
        const held = await renderTakeAudio([note(0, 60, 100, 800)], 24_000);
        const past = (durMs: number) =>
            [(LEAD_IN_MS + durMs + 150) / 1000, (LEAD_IN_MS + durMs + 300) / 1000] as const;
        expect(peak(staccato, ...past(80))).toBeLessThan(peak(held, ...past(800)));
    });
});
