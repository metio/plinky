// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { BEAMS } from "./beams";
import { DEFAULT_KEY_MAP } from "./keyMap";
import {
    BARS_PER_ROW,
    METRONOME_SUBDIVISIONS,
    NOTE_SCALES,
    parsePrefs,
    type Prefs,
    REVEAL_TRIES,
    REVIEW_CAPS,
} from "./prefs";

// parsePrefs is the only gate between a device's stored string and the whole app's
// settings, so it must total: every input — truncated JSON, a stale schema, a
// hand-edited store, an outright hostile blob — yields Prefs that are in-range and
// safe to render. These pin that totality over arbitrary input rather than over the
// handful of shapes a unit test can name.

const LETTERS = ["S", "A", "B", "C", "D"];
const NOTE_HINTS = ["always", "miss", "never"];
const NOTE_LABELS = ["all", "c", "off"];
const DECAY_MODES = ["gentle", "competitive"];

// Every constraint the Prefs type cannot express: ranges, closed choice sets, and the
// calibration's internal ordering. A returned Prefs must satisfy all of them.
function expectValid(prefs: Prefs): void {
    expect(typeof prefs.sound).toBe("boolean");
    expect(typeof prefs.showFingerings).toBe("boolean");
    expect(typeof prefs.colorNotes).toBe("boolean");
    expect(typeof prefs.forgiving).toBe("boolean");
    expect(typeof prefs.fingerHints).toBe("boolean");
    expect(typeof prefs.barNumbers).toBe("boolean");
    expect(typeof prefs.metronomeAccent).toBe("boolean");
    expect(typeof prefs.metronomeAdaptive).toBe("boolean");
    expect(typeof prefs.analyticsConsent).toBe("boolean");
    expect(typeof prefs.analyticsAsked).toBe("boolean");
    expect(typeof prefs.treadmill).toBe("boolean");
    expect(typeof prefs.highway).toBe("boolean");
    expect(typeof prefs.raceGhost).toBe("boolean");
    expect(typeof prefs.hiddenNotes).toBe("boolean");

    expect(Number.isFinite(prefs.volume)).toBe(true);
    expect(prefs.volume).toBeGreaterThanOrEqual(0);
    expect(prefs.volume).toBeLessThanOrEqual(100);

    expect(LETTERS).toContain(prefs.masteryThreshold);
    expect(BEAMS).toContain(prefs.beams);
    expect(NOTE_HINTS).toContain(prefs.noteHints);
    expect(NOTE_LABELS).toContain(prefs.noteLabels);
    expect(DECAY_MODES).toContain(prefs.decayMode);
    expect(REVIEW_CAPS).toContain(prefs.reviewCap);
    expect(BARS_PER_ROW).toContain(prefs.barsPerRow);
    expect(NOTE_SCALES).toContain(prefs.noteScale);
    expect(METRONOME_SUBDIVISIONS).toContain(prefs.metronomeSubdivision);
    expect(REVEAL_TRIES).toContain(prefs.revealTries);

    // A reach is either unmeasured or a plausible hand: nothing between.
    for (const span of [prefs.handSpan.left, prefs.handSpan.right]) {
        if (span !== null) {
            expect(Number.isInteger(span)).toBe(true);
            expect(span).toBeGreaterThanOrEqual(5);
            expect(span).toBeLessThanOrEqual(24);
        }
    }

    // Every note the player can strike keeps a binding, so no key is unreachable.
    expect(Object.keys(prefs.keyMap).sort()).toEqual(Object.keys(DEFAULT_KEY_MAP).sort());

    // The velocity map needs a live band: a loud anchor at or below the soft one
    // would collapse every dynamic onto a single level.
    if (prefs.micCalibration !== null) {
        const { noiseFloor, softLevel, loudLevel, octaveShift } = prefs.micCalibration;
        expect(loudLevel).toBeGreaterThan(softLevel);
        expect(noiseFloor).toBeGreaterThan(0);
        expect(Number.isInteger(octaveShift)).toBe(true);
        expect(Math.abs(octaveShift)).toBeLessThanOrEqual(2);
    }
}

describe("parsePrefs properties", () => {
    it("returns valid Prefs for any JSON value a store could hold", () => {
        fc.assert(
            fc.property(fc.jsonValue(), (value) => {
                expectValid(parsePrefs(JSON.stringify(value)));
            }),
        );
    });

    it("returns valid Prefs for any string, including malformed JSON", () => {
        fc.assert(
            fc.property(fc.string(), (raw) => {
                expectValid(parsePrefs(raw));
            }),
        );
    });

    it("returns valid Prefs for an object of arbitrary field values", () => {
        // Field-keyed objects reach the per-field coercions far more often than a
        // free-form JSON value does, which mostly lands on non-objects.
        const fields = fc.record(
            Object.fromEntries(
                (
                    [
                        "sound",
                        "volume",
                        "masteryThreshold",
                        "handSpan",
                        "showFingerings",
                        "beams",
                        "colorNotes",
                        "noteHints",
                        "noteLabels",
                        "forgiving",
                        "fingerHints",
                        "decayMode",
                        "reviewCap",
                        "barsPerRow",
                        "noteScale",
                        "barNumbers",
                        "keyMap",
                        "metronomeSubdivision",
                        "metronomeAccent",
                        "metronomeAdaptive",
                        "treadmill",
                        "highway",
                        "raceGhost",
                        "hiddenNotes",
                        "revealTries",
                        "micCalibration",
                        "analyticsConsent",
                        "analyticsAsked",
                    ] as const
                ).map((key) => [key, fc.jsonValue()]),
            ),
            { requiredKeys: [] },
        );
        fc.assert(
            fc.property(fields, (value) => {
                expectValid(parsePrefs(JSON.stringify(value)));
            }),
        );
    });

    it("round-trips its own output: parsing valid Prefs preserves every field", () => {
        fc.assert(
            fc.property(fc.jsonValue(), (value) => {
                const once = parsePrefs(JSON.stringify(value));
                expect(parsePrefs(JSON.stringify(once))).toEqual(once);
            }),
        );
    });

    it("nothing stored yields the same Prefs as an empty object", () => {
        expect(parsePrefs(null)).toEqual(parsePrefs("{}"));
    });
});
