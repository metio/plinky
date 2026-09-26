// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { DEFAULT_THEME, parseTheme, resolveShade } from "./theme";

describe("parseTheme", () => {
    it("accepts every palette in every mode", () => {
        expect(parseTheme({ palette: "violet", mode: "black" })).toEqual({
            palette: "violet",
            mode: "black",
        });
        expect(parseTheme({ palette: "indigo", mode: "light" })).toEqual({
            palette: "indigo",
            mode: "light",
        });
    });

    it("reads a bare stored mode as that mode in the default palette", () => {
        expect(parseTheme("dark")).toEqual({ palette: "indigo", mode: "dark" });
        expect(parseTheme("light")).toEqual({ palette: "indigo", mode: "light" });
    });

    it("repairs each half on its own", () => {
        expect(parseTheme({ palette: "neon", mode: "dark" })).toEqual({
            palette: "indigo",
            mode: "dark",
        });
        expect(parseTheme({ palette: "violet", mode: "dim" })).toEqual({
            palette: "violet",
            mode: "system",
        });
    });

    it("reads anything else as the default", () => {
        for (const value of [null, undefined, 7, "neon", [], ["dark"], {}]) {
            expect(parseTheme(value)).toEqual(DEFAULT_THEME);
        }
    });
});

describe("resolveShade", () => {
    it("keeps a chosen mode whatever the OS prefers", () => {
        expect(resolveShade("light", true)).toBe("light");
        expect(resolveShade("dark", false)).toBe("dark");
        expect(resolveShade("black", false)).toBe("black");
    });

    it("settles system to the OS preference, which is never black", () => {
        expect(resolveShade("system", true)).toBe("dark");
        expect(resolveShade("system", false)).toBe("light");
    });
});
