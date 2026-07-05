// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it } from "vitest";
import { parseTheme, resolveTheme } from "./theme";

describe("parseTheme", () => {
    it("accepts the three valid choices", () => {
        expect(parseTheme("light")).toBe("light");
        expect(parseTheme("dark")).toBe("dark");
        expect(parseTheme("system")).toBe("system");
    });

    it("coerces anything else to system", () => {
        expect(parseTheme("neon")).toBe("system");
        expect(parseTheme(null)).toBe("system");
        expect(parseTheme(7)).toBe("system");
    });
});

describe("resolveTheme", () => {
    it("resolves explicit themes directly, whatever the OS prefers", () => {
        expect(resolveTheme("light", true)).toBe("light");
        expect(resolveTheme("dark", false)).toBe("dark");
    });

    it("resolves system to the OS preference", () => {
        expect(resolveTheme("system", true)).toBe("dark");
        expect(resolveTheme("system", false)).toBe("light");
    });
});
