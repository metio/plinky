// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { METHODS } from "./practiceMethods";

describe("practiceMethods", () => {
    it("gives every method a dose and somewhere to try it", () => {
        for (const method of METHODS) {
            expect(method.minutes).toBeGreaterThan(0);
            expect(method.href.startsWith("/")).toBe(true);
            expect(method.href.endsWith("/")).toBe(true);
        }
    });

    it("has no duplicate ids, so the label lookups stay total", () => {
        expect(new Set(METHODS.map((method) => method.id)).size).toBe(METHODS.length);
    });

});
