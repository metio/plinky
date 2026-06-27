// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";
import { recordDailyDone } from "./dailyStreak";
import { recordPractice } from "./history";
import { markLearned, saveMastery } from "./mastery";
import { allFirstStepsDone, firstSteps } from "./onboarding";
import { loadPrefs, savePrefs } from "./prefs";

afterEach(() => localStorage.clear());

describe("firstSteps", () => {
    it("is all-false for a brand-new player", () => {
        expect(firstSteps()).toEqual({ played: false, handSet: false, dailyDone: false });
        expect(allFirstStepsDone(firstSteps())).toBe(false);
    });

    it("marks playing once a run is recorded", () => {
        recordPractice(40);
        expect(firstSteps().played).toBe(true);
    });

    it("marks playing once a score has mastery", () => {
        saveMastery("scale-c-major", markLearned(null, Date.now()));
        expect(firstSteps().played).toBe(true);
    });

    it("marks the hand step once a span is measured", () => {
        savePrefs({ ...loadPrefs(), handSpan: { left: null, right: 9 } });
        expect(firstSteps().handSet).toBe(true);
    });

    it("marks the daily step once a daily is completed", () => {
        recordDailyDone(5);
        expect(firstSteps().dailyDone).toBe(true);
    });

    it("is done only when all three steps are complete", () => {
        recordPractice(40);
        savePrefs({ ...loadPrefs(), handSpan: { left: 8, right: 8 } });
        recordDailyDone(1);
        expect(allFirstStepsDone(firstSteps())).toBe(true);
    });
});
