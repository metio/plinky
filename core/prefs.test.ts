// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it } from "vitest";
import { DEFAULT_KEY_MAP, rebind } from "./keyMap";
import { parsePrefs, type Prefs } from "./prefs";

const BASE: Prefs = {
    sound: true,
    volume: 80,
    masteryThreshold: "A",
    handSpan: { left: null, right: null },
    showFingerings: false,
    beams: "auto",
    colorNotes: true,
    noteHints: "always",
    noteLabels: "all",
    highway: false,
    forgiving: false,
    fingerHints: true,
    decayMode: "gentle",
    reviewCap: 8,
    barsPerRow: 0,
    noteScale: 1,
    barNumbers: true,
    keyMap: DEFAULT_KEY_MAP,
    metronomeSubdivision: 1,
    metronomeAccent: true,
    metronomeAdaptive: false,
    treadmill: false,
    raceGhost: true,
    hiddenNotes: false,
    revealTries: 1,
    micCalibration: null,
    analyticsConsent: false,
};

const CALIBRATION = { noiseFloor: 0.02, softLevel: 0.03, loudLevel: 0.2, octaveShift: -1 };

const stored = (patch: object) => JSON.stringify({ ...BASE, ...patch });

describe("parsePrefs", () => {
    it("defaults to sound on at volume 80 with no hand spans", () => {
        expect(parsePrefs(null)).toEqual(BASE);
    });

    it("round-trips stored preferences", () => {
        expect(parsePrefs(stored({ sound: false, volume: 40 }))).toEqual({
            ...BASE,
            sound: false,
            volume: 40,
        });
    });

    it("clamps the volume to 0..100", () => {
        expect(parsePrefs(stored({ volume: 250 })).volume).toBe(100);
        expect(parsePrefs(stored({ volume: -3 })).volume).toBe(0);
    });

    it("falls back to defaults for corrupt data", () => {
        expect(parsePrefs("not json")).toEqual(BASE);
    });

    it("keeps a valid decay mode and rejects an unknown value", () => {
        expect(parsePrefs(stored({ decayMode: "competitive" })).decayMode).toBe("competitive");
        expect(parsePrefs(stored({ decayMode: "savage" })).decayMode).toBe("gentle");
    });

    it("keeps a listed review cap and rejects an off-list value", () => {
        expect(parsePrefs(stored({ reviewCap: 20 })).reviewCap).toBe(20);
        expect(parsePrefs(stored({ reviewCap: 7 })).reviewCap).toBe(8);
    });

    it("keeps a per-hand span and tolerates one hand unset", () => {
        expect(parsePrefs(stored({ handSpan: { left: 8, right: 11 } })).handSpan).toEqual({
            left: 8,
            right: 11,
        });
        expect(parsePrefs(stored({ handSpan: { left: null, right: 9 } })).handSpan).toEqual({
            left: null,
            right: 9,
        });
    });

    it("drops out-of-range or malformed spans to null", () => {
        expect(parsePrefs(stored({ handSpan: { left: 3, right: "wide" } })).handSpan).toEqual({
            left: null,
            right: null,
        });
    });

    it("defaults bar numbers on and rejects a non-boolean", () => {
        expect(parsePrefs(null).barNumbers).toBe(true);
        expect(parsePrefs(JSON.stringify({ barNumbers: "yes" })).barNumbers).toBe(true);
        expect(parsePrefs(stored({ barNumbers: false })).barNumbers).toBe(false);
    });

    it("defaults fingering numbers off and keeps the stored toggle", () => {
        expect(parsePrefs(null).showFingerings).toBe(false);
        expect(parsePrefs(stored({ showFingerings: true })).showFingerings).toBe(true);
    });

    it("defaults note hints to always-on and rejects an unknown value", () => {
        expect(parsePrefs(null).noteHints).toBe("always");
        expect(parsePrefs(stored({ noteHints: "never" })).noteHints).toBe("never");
        expect(parsePrefs(JSON.stringify({ noteHints: "bogus" })).noteHints).toBe("always");
    });

    it("defaults note labels to every key and rejects an unknown value", () => {
        expect(parsePrefs(null).noteLabels).toBe("all");
        expect(parsePrefs(stored({ noteLabels: "off" })).noteLabels).toBe("off");
        expect(parsePrefs(JSON.stringify({ noteLabels: "bogus" })).noteLabels).toBe("all");
    });

    it("defaults beams to auto and rejects an unknown value", () => {
        expect(parsePrefs(null).beams).toBe("auto");
        expect(parsePrefs(stored({ beams: "off" })).beams).toBe("off");
        expect(parsePrefs(JSON.stringify({ beams: "bogus" })).beams).toBe("auto");
    });

    it("defaults note colouring on and keeps the stored toggle", () => {
        expect(parsePrefs(null).colorNotes).toBe(true);
        expect(parsePrefs(stored({ colorNotes: false })).colorNotes).toBe(false);
        expect(parsePrefs(JSON.stringify({ colorNotes: "yes" })).colorNotes).toBe(true);
    });

    it("defaults note size to 1 and rejects an off-scale value", () => {
        expect(parsePrefs(null).noteScale).toBe(1);
        expect(parsePrefs(stored({ noteScale: 1.5 })).noteScale).toBe(1.5);
        expect(parsePrefs(JSON.stringify({ noteScale: 3 })).noteScale).toBe(1);
    });

    it("defaults the key map and keeps a customised one", () => {
        expect(parsePrefs(null).keyMap).toEqual(DEFAULT_KEY_MAP);
        const custom = rebind(DEFAULT_KEY_MAP, "left", 0, "z");
        expect(parsePrefs(stored({ keyMap: custom })).keyMap.left.z).toBe(0);
    });

    it("falls back to the default key map when stored data is corrupt", () => {
        expect(parsePrefs(stored({ keyMap: { left: "oops" } })).keyMap).toEqual(DEFAULT_KEY_MAP);
    });

    it("validates the metronome voice against its allowed values", () => {
        expect(parsePrefs(null).metronomeSubdivision).toBe(1);
        expect(parsePrefs(stored({ metronomeSubdivision: 3 })).metronomeSubdivision).toBe(3);
        expect(parsePrefs(stored({ metronomeSubdivision: 9 })).metronomeSubdivision).toBe(1);
        expect(parsePrefs(stored({ metronomeAccent: false })).metronomeAccent).toBe(false);
        expect(parsePrefs(stored({ metronomeAdaptive: "yes" })).metronomeAdaptive).toBe(false);
    });

    it("defaults treadmill off and keeps the stored toggle", () => {
        expect(parsePrefs(null).treadmill).toBe(false);
        expect(parsePrefs(stored({ treadmill: true })).treadmill).toBe(true);
    });
});

describe("hidden-notes prefs", () => {
    it("validates the tries budget against the allowed values", () => {
        expect(parsePrefs(stored({ revealTries: 3 })).revealTries).toBe(3);
        expect(parsePrefs(stored({ revealTries: 7 })).revealTries).toBe(1);
        expect(parsePrefs(stored({ revealTries: "2" })).revealTries).toBe(1);
    });

    it("keeps the mode off unless a boolean says otherwise", () => {
        expect(parsePrefs(stored({ hiddenNotes: true })).hiddenNotes).toBe(true);
        expect(parsePrefs(stored({ hiddenNotes: "yes" })).hiddenNotes).toBe(false);
    });
});

describe("mic calibration prefs", () => {
    it("round-trips a well-formed calibration", () => {
        expect(parsePrefs(stored({ micCalibration: CALIBRATION })).micCalibration).toEqual(
            CALIBRATION,
        );
    });

    it("drops a calibration whose velocity anchors collapsed", () => {
        const collapsed = { ...CALIBRATION, softLevel: 0.2, loudLevel: 0.2 };
        expect(parsePrefs(stored({ micCalibration: collapsed })).micCalibration).toBeNull();
    });

    it("drops a calibration with an out-of-range or non-integer octave shift", () => {
        expect(
            parsePrefs(stored({ micCalibration: { ...CALIBRATION, octaveShift: 5 } }))
                .micCalibration,
        ).toBeNull();
        expect(
            parsePrefs(stored({ micCalibration: { ...CALIBRATION, octaveShift: 0.5 } }))
                .micCalibration,
        ).toBeNull();
    });

    it("drops a calibration missing fields or carrying a NaN", () => {
        expect(parsePrefs(stored({ micCalibration: { noiseFloor: 0.02 } })).micCalibration).toBeNull();
        expect(
            parsePrefs(stored({ micCalibration: { ...CALIBRATION, noiseFloor: Number.NaN } }))
                .micCalibration,
        ).toBeNull();
    });

    it("defaults to null when nothing is stored", () => {
        expect(parsePrefs(null).micCalibration).toBeNull();
    });
});
