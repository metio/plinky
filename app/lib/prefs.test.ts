// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";
import { loadPrefs, type Prefs, savePrefs } from "./prefs";

afterEach(() => localStorage.clear());

const BASE: Prefs = {
    sound: true,
    volume: 80,
    masteryThreshold: "A",
    handSpan: { left: null, right: null },
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

    it("round-trips a per-hand span and tolerates one hand unset", () => {
        savePrefs({ ...BASE, handSpan: { left: 8, right: 11 } });
        expect(loadPrefs().handSpan).toEqual({ left: 8, right: 11 });
        savePrefs({ ...BASE, handSpan: { left: null, right: 9 } });
        expect(loadPrefs().handSpan).toEqual({ left: null, right: 9 });
    });

    it("drops out-of-range or malformed spans to null", () => {
        localStorage.setItem(
            "plinky:prefs",
            JSON.stringify({ ...BASE, handSpan: { left: 3, right: "wide" } }),
        );
        expect(loadPrefs().handSpan).toEqual({ left: null, right: null });
    });
});
