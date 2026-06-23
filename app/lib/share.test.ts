// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it } from "vitest";
import { decodeSong, encodeSong } from "./share";

describe("share encoding", () => {
    it("round-trips an ABC tune", () => {
        const abc = "X:1\nT:My Tune\nM:4/4\nL:1/4\nK:C\nC D E F |";
        expect(decodeSong(encodeSong(abc))).toBe(abc);
    });

    it("produces a URL-safe string", () => {
        const encoded = encodeSong("X:1\nK:C\n[CEG] z/2 |");
        expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    it("preserves non-ASCII characters", () => {
        const abc = "X:1\nT:Étude\nK:C\nC |";
        expect(decodeSong(encodeSong(abc))).toBe(abc);
    });

    it("returns null for a malformed string", () => {
        expect(decodeSong("!! not base64 !!")).toBeNull();
    });
});
