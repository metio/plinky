// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { deadlineFor } from "../../core/repertoire";
import { m } from "../paraglide/messages.js";
import { deadlineText } from "./deadlineText";

const TODAY = "2026-09-11";

const textFor = (date: string): string => {
    const deadline = deadlineFor(date, TODAY);
    if (deadline === null) {
        throw new Error(`no deadline for ${date}`);
    }
    return deadlineText(deadline);
};

describe("deadlineText", () => {
    it("names the day itself as today", () => {
        expect(textFor(TODAY)).toBe(m.repertoire_due_today({ date: TODAY }));
    });

    it("counts one day off in the singular and more in the plural", () => {
        expect(textFor("2026-09-12")).toBe("2026-09-12 — 1 day away");
        expect(textFor("2026-09-18")).toBe("2026-09-18 — 7 days away");
    });

    it("says a date has gone by once it has, and never counts below zero", () => {
        expect(textFor("2026-09-10")).toBe(m.repertoire_date_passed({ date: "2026-09-10" }));
    });

    it("never reads a count of nothing, whatever the date", () => {
        fc.assert(
            fc.property(fc.integer({ min: -400, max: 400 }), (offset) => {
                const date = new Date(Date.UTC(2026, 8, 11 + offset)).toISOString().slice(0, 10);
                // The date itself is full of hyphens, so only the words after it are read.
                const words = textFor(date).replace(date, "");
                expect(words).not.toMatch(/\b0 days?\b|-\d/);
            }),
        );
    });
});
