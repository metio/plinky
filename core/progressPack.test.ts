// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { PROGRESS_FORMAT, parseProgressPack, serializeProgress } from "./progressPack";

const entries = {
    prefs: '{"noteLabels":"all"}',
    "mastery:scale-c-major": '{"bestScore":91,"learned":true}',
    theme: '"dark"',
};

function parsed(json: string) {
    const result = parseProgressPack(json);
    if (!result.ok) {
        throw new Error(`expected a readable pack, got ${result.problem}`);
    }
    return result.pack;
}

describe("progress pack", () => {
    it("round-trips every entry byte for byte", () => {
        const pack = parsed(serializeProgress(entries, "2026-07-28T10:00:00.000Z"));

        expect(pack.entries).toEqual(entries);
        expect(pack.savedAt).toBe("2026-07-28T10:00:00.000Z");
        expect(pack.format).toBe(PROGRESS_FORMAT);
    });

    it("keeps a stored JSON string distinct from the bare string it encodes", () => {
        // Values travel raw precisely so these two stay different; re-parsing on the
        // way in or out would collapse them and hand the theme store `"dark"` with
        // the quotes still attached.
        const pack = parsed(serializeProgress({ quoted: '"dark"', bare: "dark" }, ""));

        expect(pack.entries.quoted).toBe('"dark"');
        expect(pack.entries.bare).toBe("dark");
    });

    it("reports unreadable documents by problem rather than throwing", () => {
        expect(parseProgressPack("not json")).toEqual({ ok: false, problem: "json" });
        expect(parseProgressPack(JSON.stringify({ format: "plinky-scores" }))).toEqual({
            ok: false,
            problem: "format",
        });
        expect(parseProgressPack(JSON.stringify({ format: PROGRESS_FORMAT }))).toEqual({
            ok: false,
            problem: "format",
        });
    });

    it("reads a bundle carrying nothing usable as empty", () => {
        const bundle = JSON.stringify({ format: PROGRESS_FORMAT, entries: {} });

        expect(parseProgressPack(bundle)).toEqual({ ok: false, problem: "empty" });
    });

    it("drops entries that could not have been stored values", () => {
        const bundle = JSON.stringify({
            format: PROGRESS_FORMAT,
            entries: { prefs: "{}", count: 7, nested: { a: 1 }, missing: null, "": "prefixOnly" },
        });

        expect(parsed(bundle).entries).toEqual({ prefs: "{}" });
    });

    it("carries a key that names a prototype property like any other", () => {
        // JSON.parse makes "__proto__" a real own property, so a hand-written or
        // hostile bundle can carry one. It has to read back as an ordinary entry.
        const bundle = JSON.stringify({
            format: PROGRESS_FORMAT,
            entries: JSON.parse('{"__proto__":"{}","prefs":"{}"}'),
        });

        const pack = parsed(bundle);

        expect(Object.hasOwn(pack.entries, "__proto__")).toBe(true);
        expect(pack.entries.prefs).toBe("{}");
        // The value landed as an entry, not on the prototype chain.
        expect(Object.getPrototypeOf(pack.entries)).toBe(Object.prototype);
    });

    it("survives a bundle written without a savedAt", () => {
        const bundle = JSON.stringify({ format: PROGRESS_FORMAT, entries, savedAt: 17 });

        expect(parsed(bundle).savedAt).toBe("");
    });
});
