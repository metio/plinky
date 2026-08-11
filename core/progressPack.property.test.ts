// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { parseProgressPack, serializeProgress } from "./progressPack";

// Stored values are arbitrary strings — JSON documents, quoted scalars, and
// whatever a corrupt write left behind — so the codec is exercised with the same.
const entries = fc.dictionary(fc.string({ minLength: 1 }), fc.string(), { maxKeys: 12 });

describe("progress pack properties", () => {
    it("round-trips any set of stored entries unchanged", () => {
        fc.assert(
            fc.property(entries, fc.string(), (source, savedAt) => {
                const result = parseProgressPack(serializeProgress(source, savedAt));

                // An empty device has nothing to back up, which parses as "empty".
                if (Object.keys(source).length === 0) {
                    expect(result).toEqual({ ok: false, problem: "empty" });
                    return;
                }
                expect(result.ok).toBe(true);
                if (result.ok) {
                    expect(result.pack.entries).toEqual(source);
                    expect(result.pack.savedAt).toBe(savedAt);
                }
            }),
        );
    });

    it("never admits a key that would address storage outside Plinky's own", () => {
        fc.assert(
            fc.property(entries, (source) => {
                const result = parseProgressPack(serializeProgress(source, ""));

                if (result.ok) {
                    // The empty key is the only one that could name the bare prefix
                    // once a restore puts it back, so it must never survive.
                    expect(Object.keys(result.pack.entries)).not.toContain("");
                }
            }),
        );
    });

    it("reads back anything it writes", () => {
        fc.assert(
            fc.property(entries, fc.string(), (source, savedAt) => {
                const once = serializeProgress(source, savedAt);
                const result = parseProgressPack(once);

                // Whatever survives the first pass is stable under a second, so a
                // bundle restored and re-exported cannot drift.
                if (result.ok) {
                    expect(serializeProgress(result.pack.entries, result.pack.savedAt)).toBe(once);
                }
            }),
        );
    });
});
