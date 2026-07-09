// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it } from "vitest";
import { isHttpsUrl } from "./url";

describe("isHttpsUrl", () => {
    it("accepts a well-formed https URL", () => {
        expect(isHttpsUrl("https://example.com/a.png")).toBe(true);
    });

    it("rejects http, data:, javascript:, junk, and non-strings", () => {
        expect(isHttpsUrl("http://example.com")).toBe(false);
        expect(isHttpsUrl("data:image/png;base64,AAAA")).toBe(false);
        expect(isHttpsUrl("javascript:alert(1)")).toBe(false);
        expect(isHttpsUrl("not a url")).toBe(false);
        expect(isHttpsUrl(42)).toBe(false);
        expect(isHttpsUrl(undefined)).toBe(false);
    });
});
