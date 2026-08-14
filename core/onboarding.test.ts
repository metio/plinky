// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { DEFAULT_PREFS } from "./prefs";
import { DEFAULT_KEY_MAP, rebind } from "./keyMap";
import { type DiscoveryState, discoveries } from "./onboarding";

// Purely derived: the caller hands in the state, so every step is pinned with
// plain data — no stores, no storage.
const fresh = (): DiscoveryState => ({
    prefs: DEFAULT_PREFS,
    masteredCount: 0,
    history: {},
    lastDaily: 0,
    placementTaken: false,
    marked: new Set(),
});

describe("discoveries", () => {
    it("is all-false for a brand-new player", () => {
        const done = discoveries(fresh());
        expect(Object.values(done).every((value) => value === false)).toBe(true);
    });

    it("marks playing once practice or mastery exists", () => {
        expect(discoveries({ ...fresh(), history: { "2026-07-05": 40 } }).played).toBe(true);
        expect(discoveries({ ...fresh(), masteredCount: 1 }).played).toBe(true);
    });

    it("marks the hand step once a span is measured", () => {
        const prefs = { ...DEFAULT_PREFS, handSpan: { left: null, right: 9 } };
        expect(discoveries({ ...fresh(), prefs }).handSet).toBe(true);
    });

    it("marks the daily step once a daily is completed", () => {
        expect(discoveries({ ...fresh(), lastDaily: 5 }).dailyDone).toBe(true);
    });

    it("marks a markable feature step from the marked set", () => {
        const done = discoveries({ ...fresh(), marked: new Set(["earTried", "composed"]) });
        expect(done.earTried).toBe(true);
        expect(done.composed).toBe(true);
        expect(done.fingeringTried).toBe(false);
        expect(done.imported).toBe(false);
    });

    it("marks the keys step once any binding differs from the default", () => {
        const prefs = { ...DEFAULT_PREFS, keyMap: rebind(DEFAULT_KEY_MAP, "right", 0, "l") };
        expect(discoveries({ ...fresh(), prefs }).keysCustomized).toBe(true);
    });

    it("marks the keys step from the marked set too, so keeping the defaults still finishes it", () => {
        // The map is untouched (the default), so the only path left is engaging with the
        // editor, which marks the step.
        const done = discoveries({ ...fresh(), marked: new Set(["keysCustomized"]) });
        expect(done.keysCustomized).toBe(true);
    });

    it("counts a finished placement test, not an opened one", () => {
        // The step is "you know your level", so only a saved result completes it —
        // walking away from the test leaves nothing to know.
        expect(discoveries(fresh()).placed).toBe(false);
        expect(discoveries({ ...fresh(), placementTaken: true }).placed).toBe(true);
    });
});

