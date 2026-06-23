// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";
import { loadPrefs, savePrefs } from "./prefs";

afterEach(() => localStorage.clear());

describe("prefs", () => {
    it("defaults to sound on at volume 80", () => {
        expect(loadPrefs()).toEqual({ sound: true, volume: 80 });
    });

    it("round-trips saved preferences", () => {
        savePrefs({ sound: false, volume: 40 });
        expect(loadPrefs()).toEqual({ sound: false, volume: 40 });
    });

    it("clamps the volume to 0..100", () => {
        savePrefs({ sound: true, volume: 250 });
        expect(loadPrefs().volume).toBe(100);
    });

    it("falls back to defaults for corrupt data", () => {
        localStorage.setItem("plinky:prefs", "not json");
        expect(loadPrefs()).toEqual({ sound: true, volume: 80 });
    });
});
