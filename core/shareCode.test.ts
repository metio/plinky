// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it } from "vitest";
import { base64urlToBytes, bytesToBase64url, packToCode, unpackFromCode } from "./shareCode";

describe("shareCode", () => {
    it("round-trips a value through pack and unpack", () => {
        const value = { n: "Week 1", i: [["a", 100], ["b"]] };
        expect(unpackFromCode(packToCode(value))).toEqual(value);
    });

    it("produces a URL-safe token with no padding", () => {
        expect(packToCode({ x: 1, y: [1, 2, 3] })).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    it("returns null for a corrupt or empty token rather than throwing", () => {
        expect(unpackFromCode("")).toBeNull();
        expect(unpackFromCode("!!!not-base64!!!")).toBeNull();
        // Valid base64 but not zlib data.
        expect(unpackFromCode("aGVsbG8")).toBeNull();
    });

    it("round-trips raw bytes through base64url", () => {
        const bytes = new Uint8Array([0, 1, 2, 127, 250, 255]);
        expect([...base64urlToBytes(bytesToBase64url(bytes))]).toEqual([...bytes]);
    });

    it("compresses repetitive data below its raw JSON size", () => {
        const value = Array.from({ length: 2000 }, (_, i) => i % 50);
        expect(packToCode(value).length).toBeLessThan(JSON.stringify(value).length);
    });
});
