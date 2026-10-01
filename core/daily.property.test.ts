// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { DAILY_EPOCH, dailyChallenge, dailyNumber, todayKey } from "./daily";
import { isDateKey, shiftDay } from "./dateKey";
import { readTimeline } from "./musicxmlTimeline";

// The daily challenge: the one thing in Plinky every player meets on the same day, so
// two people comparing "Plinky #94" must be comparing the same phrase. It is generated
// from the date alone — never the device's catalogue — which makes the laws sharp: the
// same date gives the same music anywhere, and the number counts days rather than
// opens. Nothing here may depend on what a player has, or has done.

const arbKey = fc
    .integer({ min: Date.UTC(2026, 5, 25), max: Date.UTC(2032, 11, 31) })
    .map((at) => new Date(at - (at % 86_400_000)).toISOString().slice(0, 10));

describe("which day's challenge it is", () => {
    it("starts at one and counts days, not visits", () => {
        expect(dailyNumber(DAILY_EPOCH)).toBe(1);
        fc.assert(
            fc.property(arbKey, (key) => {
                const number = dailyNumber(key);

                expect(Number.isInteger(number)).toBe(true);
                expect(number).toBeGreaterThanOrEqual(1);
                // Tomorrow is the next one, every day, with no gaps and no repeats —
                // which is what lets a player say "#94" and be understood.
                expect(dailyNumber(shiftDay(key, 1))).toBe(number + 1);
                expect(dailyNumber(key)).toBe(number);
            }),
        );
    });

    it("names the viewer's own calendar day", () => {
        fc.assert(
            fc.property(
                fc.integer({ min: Date.UTC(2020, 0, 1), max: Date.UTC(2035, 11, 31) }),
                (at) => {
                    const key = todayKey(new Date(at));

                    // A key the rest of the arithmetic refuses would strand the day's
                    // challenge and the practice log it is filed under.
                    expect(isDateKey(key)).toBe(true);
                },
            ),
        );
    });
});

describe("the day's phrase", () => {
    it("is the same phrase for everyone on that date", () => {
        fc.assert(
            fc.property(arbKey, (key) => {
                const number = dailyNumber(key);

                // Generated from the date alone: no catalogue, no history, no device.
                expect(dailyChallenge(key, number)).toEqual(dailyChallenge(key, number));
            }),
        );
    });

    it("is a phrase a beginner could read, at a human tempo", () => {
        fc.assert(
            fc.property(arbKey, (key) => {
                const { tempo, xml } = dailyChallenge(key, dailyNumber(key));

                expect(Number.isInteger(tempo)).toBe(true);
                // Slower drags; faster turns a sight-read into a scramble.
                expect(tempo).toBeGreaterThanOrEqual(80);
                expect(tempo).toBeLessThanOrEqual(120);

                const doc = new DOMParser().parseFromString(xml, "application/xml");
                expect(doc.querySelector("parsererror")).toBeNull();
                const { notes } = readTimeline(doc);
                expect(notes.length).toBeGreaterThan(0);
                for (const note of notes) {
                    if (note.midi === null) {
                        continue;
                    }
                    // One hand in the five-finger position above middle C: a phrase
                    // that strayed outside it would ask a beginner to move.
                    expect(note.midi).toBeGreaterThanOrEqual(72);
                    expect(note.midi).toBeLessThanOrEqual(79);
                }
            }),
        );
    });

    it("lasts about the same effort however the tempo drifts", () => {
        fc.assert(
            fc.property(arbKey, (key) => {
                const { tempo, xml } = dailyChallenge(key, dailyNumber(key));
                const doc = new DOMParser().parseFromString(xml, "application/xml");

                const { end } = readTimeline(doc);
                const seconds = end * 4 * (60 / tempo);

                // Sized so the day's effort is steady — long enough that accuracy,
                // timing and flow each have signal, short enough to be a daily.
                expect(seconds).toBeGreaterThan(20);
                expect(seconds).toBeLessThan(75);
            }),
        );
    });

    it("titles the phrase with the day's number", () => {
        fc.assert(
            fc.property(arbKey, (key) => {
                const number = dailyNumber(key);

                expect(dailyChallenge(key, number).xml).toContain(`Plinky #${number}`);
            }),
        );
    });

    it("gives a different day a different phrase", () => {
        fc.assert(
            fc.property(arbKey, fc.integer({ min: 1, max: 60 }), (key, apart) => {
                const other = shiftDay(key, apart);

                // Not a law about randomness — two dates could in principle agree — but
                // a phrase pinned to the date rather than to the number is what makes
                // the daily a shared thing, and a generator ignoring the date entirely
                // would make every day identical.
                expect(dailyChallenge(key, 1).xml === dailyChallenge(other, 1).xml).toBe(false);
            }),
        );
    });
});
