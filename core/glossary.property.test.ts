// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
    CATEGORIES,
    entriesIn,
    entryById,
    GLOSSARY,
    GLOSSARY_TEMPO,
    LESSON_FOR,
    performSnippet,
    snippetSeconds,
} from "./glossary";
import { LESSONS } from "./theoryCourse";

// The notation glossary: a page per mark, each with a bar of music and a way to hear it.
// Two kinds of fault matter here and neither shows up on the page that has them. One is
// content rot — an id that no longer resolves, a lesson link pointing at a lesson that
// was renamed — which reads as a dead end to whoever followed it. The other is the
// demonstration itself: an entry whose two readings sound identical teaches nothing,
// which is the whole point of showing the mark taken away.

const arbEntry = fc.constantFrom(...GLOSSARY);
const arbTempo = fc.integer({ min: 40, max: 200 });
const LESSON_IDS = new Set(LESSONS.map((lesson) => lesson.id));

describe("the glossary as a set of pages", () => {
    it("gives every mark one page, addressable by its own name", () => {
        expect(GLOSSARY.length).toBeGreaterThan(0);
        const ids = GLOSSARY.map((entry) => entry.id);
        expect(new Set(ids).size).toBe(ids.length);
        fc.assert(
            fc.property(arbEntry, (entry) => {
                // The id is the URL segment — react-router.config prerenders
                // /glossary/<id> for every entry — so it has to survive being one.
                expect(entry.id).toMatch(/^[A-Za-z0-9-]+$/);
                expect(entryById(entry.id)).toBe(entry);
            }),
        );
    });

    it("names a new mark the way the site names everything else", () => {
        // Every other URL on the site is lower case, and these four are not: their
        // pages prerender as /glossary/keySignature and the rest, which 404 for anyone
        // who types them in lower case. They are listed rather than fixed because
        // renaming an indexed URL needs a redirect to go with it — but the list is
        // closed, so a new entry cannot quietly add a fifth.
        const CAMEL_CASE_URLS = ["keySignature", "timeSignature", "bassClef", "shapeNote"];

        for (const entry of GLOSSARY) {
            if (CAMEL_CASE_URLS.includes(entry.id)) {
                continue;
            }
            expect(entry.id).toMatch(/^[a-z0-9-]+$/);
        }
        for (const id of CAMEL_CASE_URLS) {
            expect(entryById(id)).not.toBeNull();
        }
    });

    it("files every mark under exactly one of the four questions", () => {
        const filed = CATEGORIES.flatMap((category) => entriesIn(category));

        // Grouped by what the mark controls, so the grouping must cover the glossary
        // and cover it once — an entry in neither is a page nothing links to.
        expect(filed.length).toBe(GLOSSARY.length);
        expect(new Set(filed).size).toBe(GLOSSARY.length);
        fc.assert(
            fc.property(arbEntry, (entry) => {
                expect(CATEGORIES).toContain(entry.category);
            }),
        );
    });

    it("reads anything else as no page at all", () => {
        fc.assert(
            fc.property(fc.string({ maxLength: 20 }), (id) => {
                fc.pre(!GLOSSARY.some((entry) => entry.id === id));

                expect(entryById(id)).toBeNull();
            }),
        );
        for (const hazard of ["constructor", "toString", "__proto__", ""]) {
            expect(entryById(hazard)).toBeNull();
        }
    });

    it("links only to lessons the course still teaches", () => {
        for (const [id, lesson] of Object.entries(LESSON_FOR)) {
            // A link is the honest way to close a gap a definition cannot; a link to a
            // lesson that was renamed is a dead end nobody would notice from here.
            expect(entryById(id)).not.toBeNull();
            expect(LESSON_IDS.has(lesson)).toBe(true);
        }
    });
});

describe("hearing a mark", () => {
    it("plays a phrase in order, with every note playable", () => {
        fc.assert(
            fc.property(arbEntry, arbTempo, (entry, tempo) => {
                for (const snippet of [entry.shown, entry.plain]) {
                    if (snippet === null) {
                        continue;
                    }
                    const strikes = performSnippet(snippet, tempo);

                    expect(strikes.length).toBeGreaterThan(0);
                    const delays = strikes.map((strike) => strike.delay);
                    expect([...delays].sort((a, b) => a - b)).toEqual(delays);
                    for (const strike of strikes) {
                        expect(strike.note).toBeGreaterThanOrEqual(21);
                        expect(strike.note).toBeLessThanOrEqual(108);
                        expect(strike.velocity).toBeGreaterThanOrEqual(1);
                        expect(strike.velocity).toBeLessThanOrEqual(127);
                        expect(strike.duration).toBeGreaterThan(0);
                        expect(strike.delay).toBeGreaterThanOrEqual(0);
                    }
                }
            }),
        );
    });

    it("finishes inside the time it says it takes", () => {
        fc.assert(
            fc.property(arbEntry, arbTempo, (entry, tempo) => {
                const strikes = performSnippet(entry.shown, tempo);
                const seconds = snippetSeconds(entry.shown, tempo);

                expect(seconds).toBeGreaterThan(0);
                // The surface waits this long before letting go of the keys, so a
                // phrase that ran past it would be cut off mid-note.
                for (const strike of strikes) {
                    expect(strike.delay).toBeLessThan(seconds + 1e-9);
                }
            }),
        );
    });

    it("plays faster at a faster tempo, and the same phrase either way", () => {
        fc.assert(
            fc.property(arbEntry, arbTempo, (entry, tempo) => {
                const slow = performSnippet(entry.shown, tempo);
                const fast = performSnippet(entry.shown, tempo * 2);

                expect(fast.length).toBe(slow.length);
                fast.forEach((strike, at) => {
                    const was = slow[at] as (typeof slow)[number];
                    // The same notes at the same loudness, half the clock.
                    expect(strike.note).toBe(was.note);
                    expect(strike.velocity).toBe(was.velocity);
                    expect(strike.delay).toBeCloseTo(was.delay / 2, 6);
                    expect(strike.duration).toBeCloseTo(was.duration / 2, 6);
                });
                expect(snippetSeconds(entry.shown, tempo * 2)).toBeCloseTo(
                    snippetSeconds(entry.shown, tempo) / 2,
                    6,
                );
            }),
        );
    });

    it("demonstrates something a listener could actually hear", () => {
        for (const entry of GLOSSARY) {
            if (entry.plain === null) {
                continue;
            }
            const shown = performSnippet(entry.shown, GLOSSARY_TEMPO);
            const plain = performSnippet(entry.plain, GLOSSARY_TEMPO);

            // The pair IS the explanation: an entry whose two readings sound identical
            // shows a mark that changes nothing, and should have offered one reading.
            expect(JSON.stringify(shown)).not.toBe(JSON.stringify(plain));
        }
    });

    it("plays the same phrase the same way twice", () => {
        fc.assert(
            fc.property(arbEntry, arbTempo, (entry, tempo) => {
                expect(performSnippet(entry.shown, tempo)).toEqual(
                    performSnippet(entry.shown, tempo),
                );
            }),
        );
    });
});
