// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";
import { lastDailyDone, recordDailyDone } from "./dailyDone";

afterEach(() => localStorage.clear());

describe("dailyDone", () => {
    it("starts with nothing completed", () => {
        expect(lastDailyDone()).toBe(0);
    });

    it("remembers the last daily completed", () => {
        recordDailyDone(100);
        expect(lastDailyDone()).toBe(100);
        recordDailyDone(101);
        expect(lastDailyDone()).toBe(101);
    });

    it("only ever moves forward, ignoring a replay of an older daily", () => {
        recordDailyDone(101);
        recordDailyDone(100);
        recordDailyDone(101);
        expect(lastDailyDone()).toBe(101);
    });

    it("does not track any streak or count of consecutive days", () => {
        // A gap between completed dailies is not a missed-streak event — it simply
        // updates the last completed number.
        recordDailyDone(100);
        recordDailyDone(105);
        expect(lastDailyDone()).toBe(105);
    });
});
