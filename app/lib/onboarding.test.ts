// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { testHistoryStore, testMasteryStore, testPrefsStore } from "../testing/stores";
import { afterEach, describe, expect, it } from "vitest";
import { recordDailyDone } from "./dailyDone";
import { DEFAULT_KEY_MAP, rebind } from "../../core/keyMap";
import { markLearned } from "../../core/mastery";
import { discoveries, discoveryProgress, markDiscovered } from "./onboarding";

// The state discoveries derives from, loaded fresh per assertion like the
// components do.
const state = () => ({
    prefs: testPrefsStore.load(),
    masteredCount: testMasteryStore.loadAll().length,
    history: testHistoryStore.load(),
});

afterEach(() => localStorage.clear());

describe("discoveries", () => {
    it("is all-false for a brand-new player", () => {
        const done = discoveries(state());
        expect(Object.values(done).every((value) => value === false)).toBe(true);
        expect(discoveryProgress(done).allDone).toBe(false);
        expect(discoveryProgress(done).done).toBe(0);
    });

    it("marks playing once a run is recorded", () => {
        testHistoryStore.record(40);
        expect(discoveries(state()).played).toBe(true);
    });

    it("marks playing once a score has mastery", () => {
        testMasteryStore.save("scale-c-major", markLearned(null, Date.now()));
        expect(discoveries(state()).played).toBe(true);
    });

    it("marks the hand step once a span is measured", () => {
        testPrefsStore.save({ ...testPrefsStore.load(), handSpan: { left: null, right: 9 } });
        expect(discoveries(state()).handSet).toBe(true);
    });

    it("marks the daily step once a daily is completed", () => {
        recordDailyDone(5);
        expect(discoveries(state()).dailyDone).toBe(true);
    });

    it("marks a feature step once it is reached", () => {
        markDiscovered("earTried");
        expect(discoveries(state()).earTried).toBe(true);
        expect(discoveries(state()).fingeringTried).toBe(false);
    });

    it("ignores a mark for a derived step", () => {
        markDiscovered("played" as never);
        expect(discoveries(state()).played).toBe(false);
    });

    it("marks the keys step once the layout is customised", () => {
        testPrefsStore.save({
            ...testPrefsStore.load(),
            keyMap: rebind(DEFAULT_KEY_MAP, "left", 0, "z"),
        });
        expect(discoveries(state()).keysCustomized).toBe(true);
    });
});

describe("discoveryProgress", () => {
    it("counts the completed steps and reports when all are done", () => {
        testHistoryStore.record(40);
        testPrefsStore.save({ ...testPrefsStore.load(), handSpan: { left: 8, right: 8 } });
        recordDailyDone(1);
        markDiscovered("earTried");
        markDiscovered("fingeringTried");
        markDiscovered("composed");
        markDiscovered("imported");
        testPrefsStore.save({
            ...testPrefsStore.load(),
            keyMap: rebind(DEFAULT_KEY_MAP, "left", 0, "z"),
        });

        const progress = discoveryProgress(discoveries(state()));
        expect(progress.done).toBe(progress.total);
        expect(progress.allDone).toBe(true);
    });
});
