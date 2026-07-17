// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it } from "vitest";
import type { Composition } from "./composition";
import { toMidiNotes } from "./composition";
import { buildMidiFile } from "./midiFile";
import { parseMidiFile } from "./midiParse";

// Renders a composition to a MIDI file and reads it back, the path a downloaded take
// takes to another device.
function roundTrip(composition: Composition): Composition | null {
    const bytes = buildMidiFile(toMidiNotes(composition), {
        tempo: composition.tempo,
        beatsPerBar: composition.beatsPerBar,
    });
    return parseMidiFile(bytes);
}

describe("parseMidiFile", () => {
    it("round-trips a composition written by buildMidiFile", () => {
        const composition: Composition = {
            notes: [
                { pitch: 60, startMs: 0, durationMs: 500, velocity: 90 },
                { pitch: 64, startMs: 500, durationMs: 250, velocity: 70 },
                { pitch: 67, startMs: 1000, durationMs: 1000, velocity: 110 },
            ],
            tempo: 120,
            beatsPerBar: 4,
        };
        const parsed = roundTrip(composition);
        expect(parsed).not.toBeNull();
        expect(parsed!.tempo).toBeCloseTo(120, 0);
        expect(parsed!.notes.map((n) => n.pitch)).toEqual([60, 64, 67]);
        expect(parsed!.notes.map((n) => n.velocity)).toEqual([90, 70, 110]);
        for (const [i, note] of parsed!.notes.entries()) {
            expect(note.startMs).toBeCloseTo(composition.notes[i]!.startMs, 0);
            expect(note.durationMs).toBeCloseTo(composition.notes[i]!.durationMs, 0);
        }
    });

    it("anchors the first note at time zero", () => {
        const parsed = roundTrip({
            notes: [{ pitch: 72, startMs: 2000, durationMs: 500, velocity: 80 }],
            tempo: 100,
            beatsPerBar: 4,
        });
        expect(parsed!.notes[0]!.startMs).toBe(0);
    });

    it("preserves a non-default tempo", () => {
        const parsed = roundTrip({
            notes: [{ pitch: 60, startMs: 0, durationMs: 600, velocity: 80 }],
            tempo: 90,
            beatsPerBar: 4,
        });
        expect(parsed!.tempo).toBeCloseTo(90, 0);
    });

    it("preserves a non-4/4 meter across the round-trip", () => {
        const parsed = roundTrip({
            notes: [{ pitch: 60, startMs: 0, durationMs: 500, velocity: 80 }],
            tempo: 120,
            beatsPerBar: 3,
        });
        expect(parsed!.beatsPerBar).toBe(3);
    });

    it("falls back to the default tempo on a zero-valued tempo meta", () => {
        // MThd + one MTrk: delta 0, tempo meta FF 51 03 00 00 00 (zero), a note-on/off
        // pair, end-of-track. A zero tempo would otherwise drive tempo to Infinity.
        const bytes = new Uint8Array([
            0x4d, 0x54, 0x68, 0x64, 0x00, 0x00, 0x00, 0x06, 0x00, 0x00, 0x00, 0x01, 0x01, 0xe0,
            0x4d, 0x54, 0x72, 0x6b, 0x00, 0x00, 0x00, 0x13,
            0x00, 0xff, 0x51, 0x03, 0x00, 0x00, 0x00,
            0x00, 0x90, 0x3c, 0x40,
            0x60, 0x80, 0x3c, 0x00,
            0x00, 0xff, 0x2f, 0x00,
        ]);
        const parsed = parseMidiFile(bytes);
        expect(parsed).not.toBeNull();
        expect(Number.isFinite(parsed!.tempo)).toBe(true);
        expect(parsed!.tempo).toBe(120);
        expect(parsed!.notes[0]!.durationMs).toBeGreaterThan(0);
    });

    it("returns null for bytes that are not a MIDI file", () => {
        expect(parseMidiFile(new Uint8Array([1, 2, 3, 4]))).toBeNull();
        expect(parseMidiFile(new Uint8Array())).toBeNull();
    });

    // A format-0, one-track header: "MThd", length 6, format 0, one track, 96 ticks
    // per quarter — the frame the hand-built tracks below hang their events on.
    const HEADER = [0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 0, 0, 1, 0, 96];
    // Wraps raw track-event bytes in an "MTrk" chunk with the given declared length,
    // so a test can lie about the length independently of the bytes it supplies.
    const track = (declaredLength: number, events: number[]) => [
        0x4d,
        0x54,
        0x72,
        0x6b,
        (declaredLength >>> 24) & 0xff,
        (declaredLength >>> 16) & 0xff,
        (declaredLength >>> 8) & 0xff,
        declaredLength & 0xff,
        ...events,
    ];
    const file = (...bytes: number[]) => new Uint8Array(bytes);
    // note-on C4, 96 ticks later note-off C4, end-of-track.
    const ONE_NOTE = [0x00, 0x90, 0x3c, 0x40, 0x60, 0x80, 0x3c, 0x00, 0x00, 0xff, 0x2f, 0x00];

    it("recovers real notes from a track whose declared length overruns the buffer", () => {
        // A corrupt or truncated file can claim a track is hundreds of megabytes when
        // only a handful of bytes follow. Bounding the read to the buffer keeps it from
        // grinding through phantom bytes (a frozen tab) while still reading what is there.
        const parsed = parseMidiFile(file(...HEADER, ...track(0x10000000, ONE_NOTE)));
        expect(parsed!.notes.map((n) => n.pitch)).toEqual([60]);
    });

    it("returns null rather than hanging on a truncated track", () => {
        // The header promises a track but the body is cut off mid-event.
        const parsed = parseMidiFile(file(...HEADER, ...track(0xffffffff, [0x00, 0x90])));
        expect(parsed).toBeNull();
    });

    it("ignores SMPTE timing it cannot interpret as ticks-per-quarter", () => {
        const smpteHeader = [0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 0, 0, 1, 0xe8, 0x08];
        expect(parseMidiFile(file(...smpteHeader, ...track(ONE_NOTE.length, ONE_NOTE)))).toBeNull();
    });

    it("returns null when a chunk after the header is not a track", () => {
        // The header promises a track; the bytes that follow are some other chunk.
        const alien = [0x4d, 0x54, 0x78, 0x78, 0, 0, 0, 4, 0, 0, 0, 0];
        expect(parseMidiFile(file(...HEADER, ...alien))).toBeNull();
    });

    it("skips a sysex event and keeps reading the notes after it", () => {
        // F0 <length> <bytes>: a device-specific blob carrying no musical content. Its
        // length prefix is what says where it ends — misreading it would desynchronize
        // the stream and turn every following event into garbage.
        const events = [
            0x00, 0xf0, 0x03, 0x7e, 0x7f, 0x09, // sysex, three bytes
            ...ONE_NOTE,
        ];
        const parsed = parseMidiFile(file(...HEADER, ...track(events.length, events)));
        expect(parsed!.notes.map((n) => n.pitch)).toEqual([60]);
    });

    it("steps over channel messages that carry one data byte", () => {
        // Program change (0xC0) and channel pressure (0xD0) each carry a single data
        // byte. Consuming two would swallow the next event's delta time.
        const events = [
            0x00, 0xc0, 0x05, // program change
            0x00, 0xd0, 0x40, // channel pressure
            ...ONE_NOTE,
        ];
        const parsed = parseMidiFile(file(...HEADER, ...track(events.length, events)));
        expect(parsed!.notes.map((n) => n.pitch)).toEqual([60]);
    });

    it("steps over channel messages that carry two data bytes", () => {
        // Control change (0xB0 — sustain, expression) and pitch bend (0xE0) each carry
        // two. A DAW export is full of them, so a wrong step here corrupts every note
        // that follows rather than failing loudly.
        const events = [
            0x00, 0xb0, 0x40, 0x7f, // control change: sustain down
            0x00, 0xe0, 0x00, 0x40, // pitch bend: centre
            ...ONE_NOTE,
        ];
        const parsed = parseMidiFile(file(...HEADER, ...track(events.length, events)));
        expect(parsed!.notes.map((n) => n.pitch)).toEqual([60]);
    });

    it("matches repeats of one pitch in the order they were struck", () => {
        // The same key struck twice before either release: the first note-off closes the
        // first note, so a held repeat cannot borrow the later onset's start.
        const events = [
            0x00, 0x90, 0x3c, 0x40, //       note-on C4
            0x30, 0x90, 0x3c, 0x50, //       note-on C4 again, 48 ticks later
            0x30, 0x80, 0x3c, 0x00, //       note-off C4 closes the first
            0x30, 0x80, 0x3c, 0x00, //       note-off C4 closes the second
            0x00, 0xff, 0x2f, 0x00,
        ];
        const parsed = parseMidiFile(file(...HEADER, ...track(events.length, events)));
        expect(parsed!.notes.map((n) => n.velocity)).toEqual([0x40, 0x50]);
        // 96 ticks for the first, 96 for the second: each closed by its own note-off.
        expect(parsed!.notes.map((n) => Math.round(n.durationMs))).toEqual([500, 500]);
    });

    it("drops a note-on that is never released", () => {
        // A stuck note has no duration to give it, so it cannot be rendered.
        const events = [
            0x00, 0x90, 0x3c, 0x40, // note-on C4, never released
            0x00, 0x90, 0x40, 0x40, // note-on E4
            0x60, 0x80, 0x40, 0x00, // note-off E4
            0x00, 0xff, 0x2f, 0x00,
        ];
        const parsed = parseMidiFile(file(...HEADER, ...track(events.length, events)));
        expect(parsed!.notes.map((n) => n.pitch)).toEqual([64]);
    });

    it("returns null for a file whose only track holds no notes", () => {
        const events = [0x00, 0xff, 0x2f, 0x00];
        expect(parseMidiFile(file(...HEADER, ...track(events.length, events)))).toBeNull();
    });

    it("gives a zero-length note a floor duration rather than dropping it", () => {
        // Note-on and note-off at the same tick: a real capture of the shortest possible
        // tap. A zero duration would make it silent (and unrenderable) instead.
        const events = [
            0x00, 0x90, 0x3c, 0x40,
            0x00, 0x80, 0x3c, 0x00, // note-off at the same tick
            0x00, 0xff, 0x2f, 0x00,
        ];
        const parsed = parseMidiFile(file(...HEADER, ...track(events.length, events)));
        expect(parsed!.notes).toHaveLength(1);
        expect(parsed!.notes[0]!.durationMs).toBeGreaterThan(0);
    });

    it("reads notes that share a status byte via running status", () => {
        // Two note-ons then two note-offs, each second event omitting its status byte and
        // inheriting the previous one — what any DAW writes to save space.
        const events = [
            0x00, 0x90, 0x3c, 0x40, // note-on C4
            0x00, 0x40, 0x40, //       running status: note-on E4
            0x60, 0x80, 0x3c, 0x00, // note-off C4
            0x00, 0x40, 0x00, //       running status: note-off E4
            0x00, 0xff, 0x2f, 0x00, // end of track
        ];
        const parsed = parseMidiFile(file(...HEADER, ...track(events.length, events)));
        expect(parsed!.notes.map((n) => n.pitch).sort()).toEqual([60, 64]);
    });
});
