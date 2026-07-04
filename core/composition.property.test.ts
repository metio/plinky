// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// @vitest-environment jsdom

import { domXmlCodec } from "../app/adapters/domXmlCodec";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
    type Composition,
    decodeComposition,
    encodeComposition,
    toMusicXml,
    toReplayEvents,
} from "./composition";
import { parseMusicXml } from "./musicxmlParse";

// The codec stores integer-rounded times/velocities, so generating integer fields
// models a real recording while keeping the round-trip exact.
const arbNote = fc.record({
    pitch: fc.integer({ min: 21, max: 108 }),
    startMs: fc.nat({ max: 60_000 }),
    durationMs: fc.integer({ min: 1, max: 4000 }),
    velocity: fc.integer({ min: 0, max: 127 }),
});

const arbComposition: fc.Arbitrary<Composition> = fc.record({
    notes: fc.array(arbNote, { maxLength: 80 }),
    tempo: fc.integer({ min: 20, max: 300 }),
    beatsPerBar: fc.integer({ min: 1, max: 12 }),
});

// A real recorded phrase has at least one note, reaching toMusicXml in play order;
// a note-less score engraves to an all-rest part that parseMusicXml intentionally
// rejects as null (asserted separately below), so it's excluded here.
const arbPlayable = fc
    .record({
        notes: fc.array(arbNote, { minLength: 1, maxLength: 80 }),
        tempo: fc.integer({ min: 20, max: 300 }),
        beatsPerBar: fc.integer({ min: 1, max: 12 }),
    })
    .map((composition) => ({
        ...composition,
        notes: [...composition.notes].sort((a, b) => a.startMs - b.startMs),
    }));

describe("composition codec + engraving properties", () => {
    it("recovers a composition through encode → decode", () => {
        fc.assert(
            fc.property(arbComposition, (composition) => {
                expect(decodeComposition(encodeComposition(composition))).toEqual(composition);
            }),
        );
    });

    it("returns null rather than throwing on an arbitrary code", () => {
        fc.assert(
            fc.property(fc.string(), (code) => {
                expect(() => decodeComposition(code)).not.toThrow();
            }),
        );
    });

    it("engraves MusicXML that always parses back", () => {
        fc.assert(
            fc.property(arbPlayable, (composition) => {
                expect(parseMusicXml(domXmlCodec, toMusicXml(composition))).not.toBeNull();
            }),
            { numRuns: 50 },
        );
    });

    it("engraves a note-less score to an all-rest part that parses to null", () => {
        const empty: Composition = { notes: [], tempo: 120, beatsPerBar: 4 };
        expect(parseMusicXml(domXmlCodec, toMusicXml(empty))).toBeNull();
    });

    it("replays every note exactly once, in ascending non-repeating onset order", () => {
        fc.assert(
            fc.property(arbComposition, (composition) => {
                const events = toReplayEvents(composition);
                // Onsets strictly ascend and never repeat — each is one grouped strike.
                const onsets = events.map((event) => event.atMs);
                for (let i = 1; i < onsets.length; i++) {
                    expect(onsets[i]!).toBeGreaterThan(onsets[i - 1]!);
                }
                // No note is dropped or duplicated: the event notes account for the whole
                // performance, and every note sits under its own recorded onset.
                const flattened = events.flatMap((event) =>
                    event.notes.map((n) => ({ ...n, startMs: event.atMs })),
                );
                expect(flattened).toHaveLength(composition.notes.length);
                const key = (n: {
                    pitch: number;
                    startMs: number;
                    durationMs: number;
                    velocity: number;
                }) => `${n.startMs}:${n.pitch}:${n.durationMs}:${n.velocity}`;
                expect(flattened.map(key).sort()).toEqual(composition.notes.map(key).sort());
            }),
        );
    });
});
