// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { domXmlCodec } from "../app/adapters/domXmlCodec";
import { REDUCTIONS } from "./reduction";
import { simplify } from "./simplify";

const codec = domXmlCodec;
const STEPS = ["C", "D", "E", "F", "G", "A", "B"] as const;

type Event = { pitches: { step: string; octave: number }[]; duration: number; staff: number };

// A bar of music: single notes, chords of up to four, and rests, across one or two staves.
const events: fc.Arbitrary<Event[]> = fc.array(
    fc.record({
        pitches: fc.array(
            fc.record({
                step: fc.constantFrom(...STEPS),
                octave: fc.integer({ min: 2, max: 6 }),
            }),
            { minLength: 0, maxLength: 4 },
        ),
        duration: fc.integer({ min: 1, max: 8 }),
        staff: fc.integer({ min: 1, max: 2 }),
    }),
    { minLength: 1, maxLength: 12 },
);

function scoreOf(list: Event[]): string {
    const body = list
        .map(({ pitches, duration, staff }) => {
            if (pitches.length === 0) {
                return `<note><rest/><duration>${duration}</duration><voice>${staff}</voice><staff>${staff}</staff></note>`;
            }
            return pitches
                .map(
                    ({ step, octave }, index) =>
                        `<note>${index > 0 ? "<chord/>" : ""}` +
                        `<pitch><step>${step}</step><octave>${octave}</octave></pitch>` +
                        `<duration>${duration}</duration><voice>${staff}</voice><staff>${staff}</staff></note>`,
                )
                .join("");
        })
        .join("");
    return `<?xml version="1.0"?><score-partwise><part id="P1"><measure number="1">${body}</measure></part></score-partwise>`;
}

type Placed = { key: string; onset: number };

// Every sounding note with where it falls in the bar. A chord member sounds with the note it
// follows and advances nothing; everything else, rests included, moves the clock on.
function placed(xml: string): Placed[] {
    const doc = new DOMParser().parseFromString(xml, "application/xml");
    const out: Placed[] = [];
    let clock = 0;
    let head = 0;
    for (const note of [...doc.querySelectorAll("note")]) {
        const duration = Number(note.querySelector("duration")?.textContent ?? "0");
        const member = note.querySelector("chord") !== null;
        const onset = member ? head : clock;
        if (!member) {
            head = clock;
            clock += duration;
        }
        const pitch = note.querySelector("pitch");
        if (pitch) {
            const step = pitch.querySelector("step")?.textContent ?? "";
            const octave = pitch.querySelector("octave")?.textContent ?? "";
            const staff = note.querySelector("staff")?.textContent ?? "1";
            out.push({ key: `${step}${octave}/${staff}`, onset });
        }
    }
    return out;
}

const barLength = (xml: string): number => {
    const doc = new DOMParser().parseFromString(xml, "application/xml");
    return [...doc.querySelectorAll("note")]
        .filter((note) => note.querySelector("chord") === null)
        .reduce((sum, note) => sum + Number(note.querySelector("duration")?.textContent ?? "0"), 0);
};

describe("simplify", () => {
    it("only ever removes: every surviving note keeps its pitch and its place", () => {
        // The whole claim. A reduction that moved a note, re-timed one, or invented one would
        // be an arrangement — something a person has to check — instead of a thinner reading
        // of what was written, which is what makes this safe to apply to any score at all.
        fc.assert(
            fc.property(events, fc.constantFrom(...REDUCTIONS), (list, level) => {
                const before = placed(scoreOf(list));
                const after = placed(simplify(codec, scoreOf(list), level));
                const left = new Map<string, number>();
                for (const note of before) {
                    const at = `${note.key}@${note.onset}`;
                    left.set(at, (left.get(at) ?? 0) + 1);
                }
                for (const note of after) {
                    const at = `${note.key}@${note.onset}`;
                    const remaining = left.get(at) ?? 0;
                    expect(remaining, `${at} is not in the original`).toBeGreaterThan(0);
                    left.set(at, remaining - 1);
                }
            }),
        );
    });

    it("never lengthens or shortens the bar", () => {
        fc.assert(
            fc.property(events, fc.constantFrom(...REDUCTIONS), (list, level) => {
                const xml = scoreOf(list);
                expect(barLength(simplify(codec, xml, level))).toBe(barLength(xml));
            }),
        );
    });

    it("never takes more out than the level asks for", () => {
        fc.assert(
            fc.property(events, (list) => {
                const xml = scoreOf(list);
                const counts = REDUCTIONS.map(
                    (level) => placed(simplify(codec, xml, level)).length,
                );
                // thinned keeps at least as much as outlined, which keeps at least as much
                // as melody: the levels are a ladder, not three unrelated answers.
                expect(counts[0]).toBeGreaterThanOrEqual(counts[1] ?? 0);
                expect(counts[1]).toBeGreaterThanOrEqual(counts[2] ?? 0);
            }),
        );
    });

    it("leaves no note claiming to sound with one that is gone", () => {
        fc.assert(
            fc.property(events, fc.constantFrom(...REDUCTIONS), (list, level) => {
                const doc = new DOMParser().parseFromString(
                    simplify(codec, scoreOf(list), level),
                    "application/xml",
                );
                for (const measure of [...doc.querySelectorAll("measure")]) {
                    let previous: Element | null = null;
                    for (const note of [...measure.children].filter((c) => c.tagName === "note")) {
                        if (note.querySelector("chord")) {
                            expect(
                                previous,
                                "a chord member with nothing before it",
                            ).not.toBeNull();
                        }
                        previous = note;
                    }
                }
            }),
        );
    });

    it("is stable: reducing an already reduced score takes nothing further out", () => {
        fc.assert(
            fc.property(events, fc.constantFrom(...REDUCTIONS), (list, level) => {
                const once = simplify(codec, scoreOf(list), level);
                expect(placed(simplify(codec, once, level))).toEqual(placed(once));
            }),
        );
    });
});
