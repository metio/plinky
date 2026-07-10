// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it } from "vitest";
import { isRecord } from "./guards";

describe("isRecord", () => {
    it("admits objects, including arrays", () => {
        expect(isRecord({})).toBe(true);
        expect(isRecord({ a: 1 })).toBe(true);
        expect(isRecord([])).toBe(true);
    });

    it("rejects null and primitives", () => {
        expect(isRecord(null)).toBe(false);
        expect(isRecord(undefined)).toBe(false);
        expect(isRecord("a")).toBe(false);
        expect(isRecord(1)).toBe(false);
        expect(isRecord(true)).toBe(false);
    });
});
