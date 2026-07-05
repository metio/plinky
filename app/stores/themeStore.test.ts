// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";
import { memoryStore } from "../adapters/memoryStore";
import { createThemeStore, themeBootstrapScript } from "./themeStore";

describe("themeStore", () => {
    it("defaults to system", () => {
        expect(createThemeStore(memoryStore()).load()).toBe("system");
    });

    it("round-trips a choice and notifies", () => {
        const store = createThemeStore(memoryStore());
        const onChange = vi.fn();
        store.subscribe(onChange);
        expect(store.save("dark")).toBe(true);
        expect(store.load()).toBe("dark");
        expect(onChange).toHaveBeenCalledTimes(1);
    });

    it("reads a corrupt or foreign stored value as system", () => {
        expect(createThemeStore(memoryStore({ "plinky:theme": "not json" })).load()).toBe("system");
        expect(createThemeStore(memoryStore({ "plinky:theme": '"neon"' })).load()).toBe("system");
    });

    it("reports a refused write", () => {
        const store = createThemeStore({ ...memoryStore(), set: () => false });
        expect(store.save("light")).toBe(false);
        expect(store.load()).toBe("system");
    });
});

// The inline pre-paint script must agree with the store: same key, same JSON
// format, same fallbacks — evaluated for real against jsdom.
describe("themeBootstrapScript", () => {
    const runScript = (prefersDark: boolean) => {
        const original = window.matchMedia;
        window.matchMedia = (() => ({
            matches: prefersDark,
        })) as unknown as typeof window.matchMedia;
        // Evaluated exactly as the page ships it, in global scope.
        new Function(themeBootstrapScript())();
        window.matchMedia = original;
        const dark = document.documentElement.classList.contains("dark");
        document.documentElement.classList.remove("dark");
        return dark;
    };

    it("applies a stored dark theme before paint", () => {
        localStorage.setItem("plinky:theme", JSON.stringify("dark"));
        expect(runScript(false)).toBe(true);
        localStorage.clear();
    });

    it("keeps a stored light theme light even on a dark OS", () => {
        localStorage.setItem("plinky:theme", JSON.stringify("light"));
        expect(runScript(true)).toBe(false);
        localStorage.clear();
    });

    it("follows the OS when nothing is stored", () => {
        expect(runScript(true)).toBe(true);
        expect(runScript(false)).toBe(false);
    });

    it("still falls back to the OS preference when the stored value is corrupt", () => {
        // A parse failure must not skip theming — only the parse is guarded.
        localStorage.setItem("plinky:theme", "not json");
        expect(runScript(true)).toBe(true);
        localStorage.clear();
    });
});
