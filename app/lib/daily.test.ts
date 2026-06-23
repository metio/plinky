// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it } from "vitest";
import { dailyPhrase, todayKey } from "./daily";

describe("daily challenge", () => {
    it("formats the date key as YYYY-MM-DD", () => {
        expect(todayKey(new Date("2026-06-23T15:04:00Z"))).toBe("2026-06-23");
    });

    it("produces the same phrase for the same day", () => {
        expect(dailyPhrase("2026-06-23")).toBe(dailyPhrase("2026-06-23"));
    });

    it("produces different phrases on different days", () => {
        expect(dailyPhrase("2026-06-23")).not.toBe(dailyPhrase("2026-06-24"));
    });
});
