// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";
import { recordDailyDone } from "./dailyDone";
import { recordPractice } from "./history";
import { DEFAULT_KEY_MAP, rebind } from "../../core/keyMap";
import { markLearned, saveMastery } from "./mastery";
import { discoveries, discoveryProgress, markDiscovered } from "./onboarding";
import { browserStore } from "../adapters/browserStore";
import { createPrefsStore } from "../stores/prefsStore";

const prefsStore = createPrefsStore(browserStore);

afterEach(() => localStorage.clear());

describe("discoveries", () => {
    it("is all-false for a brand-new player", () => {
        const done = discoveries(prefsStore.load());
        expect(Object.values(done).every((value) => value === false)).toBe(true);
        expect(discoveryProgress(done).allDone).toBe(false);
        expect(discoveryProgress(done).done).toBe(0);
    });

    it("marks playing once a run is recorded", () => {
        recordPractice(40);
        expect(discoveries(prefsStore.load()).played).toBe(true);
    });

    it("marks playing once a score has mastery", () => {
        saveMastery("scale-c-major", markLearned(null, Date.now()));
        expect(discoveries(prefsStore.load()).played).toBe(true);
    });

    it("marks the hand step once a span is measured", () => {
        prefsStore.save({ ...prefsStore.load(), handSpan: { left: null, right: 9 } });
        expect(discoveries(prefsStore.load()).handSet).toBe(true);
    });

    it("marks the daily step once a daily is completed", () => {
        recordDailyDone(5);
        expect(discoveries(prefsStore.load()).dailyDone).toBe(true);
    });

    it("marks a feature step once it is reached", () => {
        markDiscovered("earTried");
        expect(discoveries(prefsStore.load()).earTried).toBe(true);
        expect(discoveries(prefsStore.load()).fingeringTried).toBe(false);
    });

    it("ignores a mark for a derived step", () => {
        markDiscovered("played" as never);
        expect(discoveries(prefsStore.load()).played).toBe(false);
    });

    it("marks the keys step once the layout is customised", () => {
        prefsStore.save({ ...prefsStore.load(), keyMap: rebind(DEFAULT_KEY_MAP, "left", 0, "z") });
        expect(discoveries(prefsStore.load()).keysCustomized).toBe(true);
    });
});

describe("discoveryProgress", () => {
    it("counts the completed steps and reports when all are done", () => {
        recordPractice(40);
        prefsStore.save({ ...prefsStore.load(), handSpan: { left: 8, right: 8 } });
        recordDailyDone(1);
        markDiscovered("earTried");
        markDiscovered("fingeringTried");
        markDiscovered("composed");
        markDiscovered("imported");
        prefsStore.save({ ...prefsStore.load(), keyMap: rebind(DEFAULT_KEY_MAP, "left", 0, "z") });

        const progress = discoveryProgress(discoveries(prefsStore.load()));
        expect(progress.done).toBe(progress.total);
        expect(progress.allDone).toBe(true);
    });
});
