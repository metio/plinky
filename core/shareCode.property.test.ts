// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { base64urlToBytes, bytesToBase64url, packToCode, unpackFromCode } from "./shareCode";

// The codec backs every share link (ghost races, assignment links). The example
// tests pin specific shapes; these pin the round-trip and the never-throw contract
// over inputs we'd never enumerate by hand — empty, huge, deeply nested, unicode.
describe("shareCode properties", () => {
    it("is transparent to a JSON round-trip through pack → unpack", () => {
        // The codec is JSON.stringify + compress + base64url, so it preserves exactly
        // what a plain JSON round-trip would — including JSON's own quirks (a lone -0
        // normalises to 0). Comparing against JSON.parse(JSON.stringify(...)) pins that
        // transparency without claiming to out-do JSON.
        fc.assert(
            fc.property(fc.jsonValue(), (value) => {
                expect(unpackFromCode(packToCode(value))).toEqual(
                    JSON.parse(JSON.stringify(value)),
                );
            }),
        );
    });

    it("recovers any byte string through the base64url round-trip", () => {
        fc.assert(
            fc.property(fc.uint8Array(), (bytes) => {
                expect(base64urlToBytes(bytesToBase64url(bytes))).toEqual(bytes);
            }),
        );
    });

    it("returns null rather than throwing on a malformed token", () => {
        fc.assert(
            fc.property(fc.string(), (code) => {
                expect(() => unpackFromCode(code)).not.toThrow();
            }),
        );
    });
});
