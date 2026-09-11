// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
    COMPOSE_MAX_TEMPO,
    COMPOSE_MIN_TEMPO,
    decodeComposition,
    encodeComposition,
    toMidiNotes,
} from "./composition";
import { buildMidiFile } from "./midiFile";
import { parseMidiFile } from "./midiParse";

describe("parseMidiFile (properties)", () => {
    it("reads back exactly the whole-number tempo buildMidiFile wrote, across Compose's range", () => {
        fc.assert(
            fc.property(fc.integer({ min: COMPOSE_MIN_TEMPO, max: COMPOSE_MAX_TEMPO }), (tempo) => {
                const composition = {
                    notes: [{ pitch: 60, startMs: 0, durationMs: 500, velocity: 80 }],
                    tempo,
                    beatsPerBar: 4,
                };
                const bytes = buildMidiFile(toMidiNotes(composition), { tempo });
                expect(parseMidiFile(bytes)?.tempo).toBe(tempo);
            }),
            { numRuns: COMPOSE_MAX_TEMPO - COMPOSE_MIN_TEMPO + 1 },
        );
    });

    // One channel event with an explicit status byte. The keys and levels straddle the
    // seven-bit edge (0x7f real, 0x80 and up corrupt), and there are few of them on two
    // channels, so a corrupt note-on meets its own note-off often enough to become a note
    // when the parser lets one through.
    const arbEvent = fc.record({
        delta: fc.integer({ min: 0, max: 400 }),
        on: fc.boolean(),
        channel: fc.integer({ min: 0, max: 1 }),
        key: fc.constantFrom(0x00, 0x3c, 0x7f, 0x80, 0xc8, 0xff),
        level: fc.constantFrom(0x00, 0x01, 0x40, 0x7f, 0x80, 0xc8, 0xff),
    });

    const HEADER = [0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 0, 0, 1, 0, 96];

    function trackOf(events: Event[]): Uint8Array {
        const body: number[] = [];
        for (const event of events) {
            // The delta as a variable-length quantity: at most 400 fits in two bytes.
            if (event.delta >= 0x80) {
                body.push(0x80 | (event.delta >> 7));
            }
            body.push(event.delta & 0x7f);
            body.push((event.on ? 0x90 : 0x80) | event.channel, event.key, event.level);
        }
        body.push(0x00, 0xff, 0x2f, 0x00);
        const length = body.length;
        return new Uint8Array([
            ...HEADER,
            0x4d,
            0x54,
            0x72,
            0x6b,
            (length >>> 24) & 0xff,
            (length >>> 16) & 0xff,
            (length >>> 8) & 0xff,
            length & 0xff,
            ...body,
        ]);
    }

    it("returns only takes the share-code decoder accepts, and they round-trip", () => {
        fc.assert(
            fc.property(fc.array(arbEvent, { maxLength: 60 }), (events) => {
                const parsed = parseMidiFile(trackOf(events));
                if (parsed === null) {
                    return;
                }
                for (const note of parsed.notes) {
                    expect(note.pitch).toBeGreaterThanOrEqual(0);
                    expect(note.pitch).toBeLessThanOrEqual(127);
                    expect(note.velocity).toBeGreaterThanOrEqual(1);
                    expect(note.velocity).toBeLessThanOrEqual(127);
                }
                const decoded = decodeComposition(encodeComposition(parsed));
                expect(decoded).not.toBeNull();
                expect(decoded?.tempo).toBe(parsed.tempo);
                expect(decoded?.beatsPerBar).toBe(parsed.beatsPerBar);
                expect(decoded?.notes.map((note) => note.pitch)).toEqual(
                    parsed.notes.map((note) => note.pitch),
                );
                expect(decoded?.notes.map((note) => note.velocity)).toEqual(
                    parsed.notes.map((note) => note.velocity),
                );
                expect(decoded?.notes.map((note) => note.startMs)).toEqual(
                    parsed.notes.map((note) => Math.round(note.startMs)),
                );
            }),
        );
    });
});

type Event = { delta: number; on: boolean; channel: number; key: number; level: number };
