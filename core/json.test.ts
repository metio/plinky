// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it, vi } from "vitest";
import { jsonOf, NOT_JSON, parseJson } from "./json";

describe("jsonOf", () => {
    it("hands back what the text carries, null included", () => {
        expect(jsonOf('{"a":1}')).toEqual({ a: 1 });
        expect(jsonOf("null")).toBeNull();
    });

    it("tells text that is not JSON apart from any value JSON can carry", () => {
        expect(jsonOf("{not json")).toBe(NOT_JSON);
        expect(jsonOf("")).toBe(NOT_JSON);
    });
});

describe("parseJson", () => {
    const coerce = (parsed: unknown): number => (typeof parsed === "number" ? parsed : -1);

    it("reads nothing stored as the fallback without calling coerce", () => {
        const spy = vi.fn(coerce);
        expect(parseJson(null, 7, spy)).toBe(7);
        expect(spy).not.toHaveBeenCalled();
    });

    it("reads corrupt JSON as the fallback rather than throwing", () => {
        expect(parseJson("{not json", 7, coerce)).toBe(7);
    });

    it("hands valid JSON to coerce", () => {
        expect(parseJson("42", 7, coerce)).toBe(42);
        expect(parseJson('"junk"', 7, coerce)).toBe(-1);
    });

    it("contains a throwing coerce to the fallback", () => {
        expect(
            parseJson("42", 7, () => {
                throw new Error("bad shape");
            }),
        ).toBe(7);
    });
});
