// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { zlibSync } from "fflate";
import { describe, expect, it } from "vitest";
import {
    base64urlToBytes,
    bytesToBase64url,
    MAX_CODE_LENGTH,
    MAX_DECODED_BYTES,
    packToCode,
    unpackFromCode,
} from "./shareCode";

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

    describe("hostile links", () => {
        // A short token of highly compressible data — the shape of a decompression
        // bomb, which expands by a ratio the token itself never reveals.
        const bomb = (bytes: number) =>
            bytesToBase64url(zlibSync(new Uint8Array(bytes), { level: 9 }));

        it("refuses a token that expands past the budget", () => {
            const expanded = MAX_DECODED_BYTES * 8;
            const code = bomb(expanded);
            // The link gives no sign of what it holds: a token this short would pass
            // any length check a URL could impose.
            expect(code.length).toBeLessThan(expanded / 100);
            expect(unpackFromCode(code)).toBeNull();
        });

        it("refuses an over-long token without decoding it", () => {
            expect(unpackFromCode("A".repeat(MAX_CODE_LENGTH + 1))).toBeNull();
        });

        it("caps what even the largest admissible token can yield", () => {
            // The two limits have to close together: this token passes the length
            // check, so only the output budget stands between it and 32 MB of heap.
            const code = bomb(32 * 1024 * 1024);
            expect(code.length).toBeLessThanOrEqual(MAX_CODE_LENGTH);
            expect(unpackFromCode(code)).toBeNull();
        });

        it("still round-trips a payload that fits the budget", () => {
            const value = { notes: Array.from({ length: 5000 }, (_, i) => i) };
            const code = packToCode(value);
            expect(code.length).toBeLessThan(MAX_CODE_LENGTH);
            expect(unpackFromCode(code)).toEqual(value);
        });
    });
});
