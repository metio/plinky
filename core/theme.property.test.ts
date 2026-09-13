// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { MODES, PALETTES, parseTheme, resolveShade } from "./theme";

const theme = fc.record({
    palette: fc.constantFrom(...PALETTES),
    mode: fc.constantFrom(...MODES),
});
// Whatever a device might hold under the key: a real theme, a bare mode, or anything
// JSON can spell.
const stored = fc.oneof(theme, fc.constantFrom(...MODES), fc.jsonValue());

describe("parseTheme properties", () => {
    it("always returns a valid palette and mode", () => {
        fc.assert(
            fc.property(stored, (value) => {
                const parsed = parseTheme(value);
                expect(PALETTES).toContain(parsed.palette);
                expect(MODES).toContain(parsed.mode);
            }),
        );
    });

    it("returns a valid theme unchanged, and nothing else beside it", () => {
        fc.assert(
            fc.property(theme, (value) => {
                expect(parseTheme(value)).toEqual(value);
                expect(Object.keys(parseTheme({ ...value, extra: 1 })).sort()).toEqual([
                    "mode",
                    "palette",
                ]);
            }),
        );
    });

    it("is settled after one pass", () => {
        fc.assert(
            fc.property(stored, (value) => {
                const once = parseTheme(value);
                expect(parseTheme(once)).toEqual(once);
            }),
        );
    });
});

describe("resolveShade properties", () => {
    it("consults the OS only for system, and never answers black for it", () => {
        fc.assert(
            fc.property(fc.constantFrom(...MODES), fc.boolean(), (mode, prefersDark) => {
                const shade = resolveShade(mode, prefersDark);
                if (mode === "system") {
                    expect(shade).toBe(prefersDark ? "dark" : "light");
                } else {
                    expect(shade).toBe(mode);
                    expect(resolveShade(mode, !prefersDark)).toBe(shade);
                }
            }),
        );
    });
});
