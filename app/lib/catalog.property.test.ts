// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import type { XmlCodec } from "../../core/xml";
import { memoryStore } from "../adapters/memoryStore";
import { quotaStore } from "../testing/quotaStore";
import {
    buildScore,
    exportAllPack,
    importScoresPack,
    loadCatalog,
    loadUserScores,
    parseUserScores,
    removeUserScore,
    resolveScore,
    type Score,
    saveUserScore,
} from "./catalog";

// A player's imported pieces: the one part of the catalogue that is theirs and cannot be
// fetched again. What matters is that the library never loses a piece it said it kept,
// never holds two of the same id, and survives whatever is actually in storage — a score
// written by an older build, an entry somebody hand-edited, a value that is not a score
// at all. A title that is not a string used to be enough to take down every page that
// sorts the catalogue.

// Without a DOM parser the codec answers null and the metadata read takes its text pass,
// the same route the static prerender uses.
const codec: XmlCodec = { parse: () => null, serialize: () => "" };

const musicXml = (title: string) =>
    `<?xml version="1.0"?><score-partwise><work><work-title>${title}</work-title></work><identification><creator type="composer">Bach</creator></identification><part id="P1"><measure number="1"><attributes><time><beats>4</beats><beat-type>4</beat-type></time></attributes><note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration></note></measure></part></score-partwise>`;

const arbTitle = fc.stringMatching(/^[A-Za-z][A-Za-z ]{0,14}$/);
const arbScore: fc.Arbitrary<Score> = fc
    .tuple(fc.constantFrom("one", "two", "three", "four"), arbTitle)
    .map(([id, title]) => ({
        id,
        title,
        composer: "Bach",
        description: "",
        xml: musicXml(title),
        tempo: 90,
        beatsPerBar: 4,
        bundled: false,
    }));

// Whatever might sit in the library's key: an older build's array, something hand-edited,
// a value that is not a library at all.
const arbStored = fc.oneof(
    fc.string({ maxLength: 40 }),
    fc.jsonValue({ maxDepth: 3 }).map((value) => JSON.stringify(value)),
    fc
        .array(
            fc.record(
                {
                    id: fc.oneof(fc.string(), fc.integer(), fc.constant(null)),
                    title: fc.oneof(fc.string(), fc.integer(), fc.constant(null)),
                    xml: fc.oneof(fc.string(), fc.integer()),
                    tempo: fc.oneof(fc.double(), fc.string(), fc.constant(null)),
                    beatsPerBar: fc.oneof(fc.double(), fc.string(), fc.constant(null)),
                },
                { requiredKeys: [] },
            ),
            { maxLength: 5 },
        )
        .map((entries) => JSON.stringify(entries)),
);

describe("the library of imported pieces", () => {
    it("holds each piece once, and the catalogue can always be shown", () => {
        fc.assert(
            fc.property(
                fc.array(fc.oneof(arbScore, fc.constantFrom("one", "two", "three", "four")), {
                    maxLength: 12,
                }),
                (steps) => {
                    const kv = memoryStore();
                    const expected = new Map<string, Score>();

                    for (const step of steps) {
                        if (typeof step === "string") {
                            removeUserScore(kv, step);
                            expected.delete(step);
                        } else {
                            expect(saveUserScore(kv, step)).toBe(true);
                            expected.set(step.id, step);
                        }

                        const held = loadUserScores(kv);
                        expect(new Set(held.map((score) => score.id))).toEqual(
                            new Set(expected.keys()),
                        );
                        expect(held.length).toBe(expected.size);
                        for (const score of held) {
                            expect(score.title).toBe(expected.get(score.id)?.title);
                            expect(resolveScore(kv, score.id)?.id).toBe(score.id);
                        }
                    }

                    // The whole catalogue still sorts and still names every piece once.
                    const catalogue = loadCatalog(kv);
                    expect(new Set(catalogue.map((score) => score.id)).size).toBe(catalogue.length);
                    const titles = catalogue.map((score) => score.title);
                    expect([...titles].sort((a, b) => a.localeCompare(b))).toEqual(titles);
                    for (const id of expected.keys()) {
                        expect(catalogue.some((score) => score.id === id)).toBe(true);
                    }
                },
            ),
        );
    });

    it("reads whatever is in storage as a library of usable pieces", () => {
        fc.assert(
            fc.property(arbStored, (raw) => {
                const kv = memoryStore({ "plinky:scores": raw });

                expect(() => parseUserScores(raw)).not.toThrow();
                const scores = parseUserScores(raw);

                for (const score of scores) {
                    // The fields every page assumes: a title to sort by, an id to route
                    // to, notation to render, and a tempo the playback maths survives.
                    expect(typeof score.id).toBe("string");
                    expect(typeof score.title).toBe("string");
                    expect(typeof score.xml).toBe("string");
                    expect(score.tempo).toBeGreaterThan(0);
                    expect(score.beatsPerBar).toBeGreaterThan(0);
                    expect(Number.isFinite(score.tempo)).toBe(true);
                    expect(Number.isFinite(score.beatsPerBar)).toBe(true);
                }
                // …and the catalogue built on top of it still sorts rather than throwing.
                expect(() => loadCatalog(kv)).not.toThrow();
            }),
        );
    });

    it("says so when the device refuses a write, and keeps what it had", () => {
        fc.assert(
            fc.property(arbScore, arbScore, (kept, refused) => {
                fc.pre(kept.id !== refused.id);
                const kv = memoryStore();
                saveUserScore(kv, kept);
                const before = loadUserScores(kv);
                const full = quotaStore({ "plinky:scores": kv.get("plinky:scores") ?? "[]" }, 0);

                expect(saveUserScore(full, refused)).toBe(false);

                expect(loadUserScores(full).map((score) => score.id)).toEqual(
                    before.map((score) => score.id),
                );
                // An import that cannot be stored is not reported as imported: it says
                // the device is full rather than leaving the player believing it landed.
                const elsewhere = memoryStore();
                saveUserScore(elsewhere, refused);
                expect(() => importScoresPack(full, codec, exportAllPack(elsewhere))).toThrow();
                expect(loadUserScores(full).map((score) => score.id)).toEqual(
                    before.map((score) => score.id),
                );
            }),
        );
    });

    it("gives an imported piece an id nothing else in the catalogue has", () => {
        fc.assert(
            fc.property(
                arbTitle,
                fc.array(fc.stringMatching(/^[a-z0-9-]{1,12}$/), { maxLength: 10 }),
                (title, taken) => {
                    const score = buildScore(codec, musicXml(title), taken);

                    expect(taken).not.toContain(score.id);
                    expect(score.id).not.toBe("");
                    expect(score.bundled).toBe(false);
                    // Asked again with the new id taken, it moves along rather than
                    // handing out the same one.
                    expect(buildScore(codec, musicXml(title), [...taken, score.id]).id).not.toBe(
                        score.id,
                    );
                },
            ),
        );
    });

    it("carries a library out and back in", () => {
        fc.assert(
            fc.property(fc.array(arbScore, { minLength: 1, maxLength: 5 }), (scores) => {
                const source = memoryStore();
                for (const score of scores) {
                    saveUserScore(source, score);
                }
                const kept = loadUserScores(source);

                const landed = memoryStore();
                const { imported } = importScoresPack(landed, codec, exportAllPack(source));

                expect(imported).toBe(kept.length);
                expect(
                    loadUserScores(landed).map((score) => [score.id, score.title, score.xml]),
                ).toEqual(kept.map((score) => [score.id, score.title, score.xml]));
            }),
        );
    });
});
