// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";
import { DEFAULT_KEY_MAP, rebind } from "./keyMap";
import { loadPrefs, type Prefs, savePrefs } from "./prefs";

afterEach(() => localStorage.clear());

const BASE: Prefs = {
    sound: true,
    volume: 80,
    masteryThreshold: "A",
    handSpan: { left: null, right: null },
    showFingerings: true,
    noteHints: "miss",
    forgiving: false,
    fingerHints: true,
    decayMode: "gentle",
    reviewCap: 8,
    barsPerRow: 0,
    keyMap: DEFAULT_KEY_MAP,
    keyboardOctaves: 2,
    treadmill: false,
    raceGhost: true,
};

describe("prefs", () => {
    it("defaults to sound on at volume 80 with no hand spans", () => {
        expect(loadPrefs()).toEqual(BASE);
    });

    it("round-trips saved preferences", () => {
        savePrefs({ ...BASE, sound: false, volume: 40 });
        expect(loadPrefs()).toEqual({ ...BASE, sound: false, volume: 40 });
    });

    it("clamps the volume to 0..100", () => {
        savePrefs({ ...BASE, volume: 250 });
        expect(loadPrefs().volume).toBe(100);
    });

    it("falls back to defaults for corrupt data", () => {
        localStorage.setItem("plinky:prefs", "not json");
        expect(loadPrefs()).toEqual(BASE);
    });

    it("round-trips the decay mode and rejects an unknown value", () => {
        savePrefs({ ...BASE, decayMode: "competitive" });
        expect(loadPrefs().decayMode).toBe("competitive");
        localStorage.setItem("plinky:prefs", JSON.stringify({ ...BASE, decayMode: "savage" }));
        expect(loadPrefs().decayMode).toBe("gentle");
    });

    it("round-trips the review cap and rejects an off-list value", () => {
        savePrefs({ ...BASE, reviewCap: 20 });
        expect(loadPrefs().reviewCap).toBe(20);
        localStorage.setItem("plinky:prefs", JSON.stringify({ ...BASE, reviewCap: 7 }));
        expect(loadPrefs().reviewCap).toBe(8);
    });

    it("round-trips a per-hand span and tolerates one hand unset", () => {
        savePrefs({ ...BASE, handSpan: { left: 8, right: 11 } });
        expect(loadPrefs().handSpan).toEqual({ left: 8, right: 11 });
        savePrefs({ ...BASE, handSpan: { left: null, right: 9 } });
        expect(loadPrefs().handSpan).toEqual({ left: null, right: 9 });
    });

    it("defaults fingering hints on and round-trips the toggle", () => {
        expect(loadPrefs().showFingerings).toBe(true);
        savePrefs({ ...BASE, showFingerings: false });
        expect(loadPrefs().showFingerings).toBe(false);
    });

    it("defaults note hints to after-a-mistake and round-trips the choice", () => {
        expect(loadPrefs().noteHints).toBe("miss");
        savePrefs({ ...BASE, noteHints: "never" });
        expect(loadPrefs().noteHints).toBe("never");
    });

    it("rejects an unknown note-hint value", () => {
        localStorage.setItem("plinky:prefs", JSON.stringify({ noteHints: "bogus" }));
        expect(loadPrefs().noteHints).toBe("miss");
    });

    it("drops out-of-range or malformed spans to null", () => {
        localStorage.setItem(
            "plinky:prefs",
            JSON.stringify({ ...BASE, handSpan: { left: 3, right: "wide" } }),
        );
        expect(loadPrefs().handSpan).toEqual({ left: null, right: null });
    });

    it("defaults the key map and round-trips a customised one", () => {
        expect(loadPrefs().keyMap).toEqual(DEFAULT_KEY_MAP);
        const custom = rebind(DEFAULT_KEY_MAP, "left", 0, "z");
        savePrefs({ ...BASE, keyMap: custom });
        expect(loadPrefs().keyMap.left.z).toBe(0);
    });

    it("falls back to the default key map when stored data is corrupt", () => {
        localStorage.setItem("plinky:prefs", JSON.stringify({ ...BASE, keyMap: { left: "oops" } }));
        expect(loadPrefs().keyMap).toEqual(DEFAULT_KEY_MAP);
    });

    it("defaults to a two-octave keyboard window and rejects an off-list value", () => {
        expect(loadPrefs().keyboardOctaves).toBe(2);
        savePrefs({ ...BASE, keyboardOctaves: 0 });
        expect(loadPrefs().keyboardOctaves).toBe(0);
        localStorage.setItem("plinky:prefs", JSON.stringify({ ...BASE, keyboardOctaves: 7 }));
        expect(loadPrefs().keyboardOctaves).toBe(2);
    });

    it("defaults treadmill off and round-trips the toggle", () => {
        expect(loadPrefs().treadmill).toBe(false);
        savePrefs({ ...BASE, treadmill: true });
        expect(loadPrefs().treadmill).toBe(true);
    });
});
