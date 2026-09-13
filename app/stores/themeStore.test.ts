// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import fc from "fast-check";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MODES, PALETTES } from "../../core/theme";
import { memoryStore } from "../adapters/memoryStore";
import { applyTheme } from "../lib/theme";
import { createThemeStore, THEME_STORAGE_KEY, themeBootstrapScript } from "./themeStore";

describe("themeStore", () => {
    it("defaults to the default palette, following the OS", () => {
        expect(createThemeStore(memoryStore()).load()).toEqual({
            palette: "indigo",
            mode: "system",
        });
    });

    it("round-trips a choice and notifies", () => {
        const store = createThemeStore(memoryStore());
        const onChange = vi.fn();
        store.subscribe(onChange);
        expect(store.save({ palette: "violet", mode: "black" })).toBe(true);
        expect(store.load()).toEqual({ palette: "violet", mode: "black" });
        expect(onChange).toHaveBeenCalledTimes(1);
    });

    it("keeps a mode a device saved before there were palettes", () => {
        const store = createThemeStore(memoryStore({ [THEME_STORAGE_KEY]: '"dark"' }));
        expect(store.load()).toEqual({ palette: "indigo", mode: "dark" });
    });

    it("reads a corrupt or foreign stored value as the default", () => {
        const corrupt = createThemeStore(memoryStore({ [THEME_STORAGE_KEY]: "not json" }));
        expect(corrupt.load()).toEqual({ palette: "indigo", mode: "system" });
        const foreign = createThemeStore(memoryStore({ [THEME_STORAGE_KEY]: '"neon"' }));
        expect(foreign.load()).toEqual({ palette: "indigo", mode: "system" });
    });

    it("reports a refused write", () => {
        const store = createThemeStore({ ...memoryStore(), set: () => false });
        expect(store.save({ palette: "violet", mode: "light" })).toBe(false);
        expect(store.load()).toEqual({ palette: "indigo", mode: "system" });
    });
});

// What the document wears: the two classes and the palette attribute.
function worn() {
    const root = document.documentElement;
    return {
        dark: root.classList.contains("dark"),
        black: root.classList.contains("black"),
        palette: root.getAttribute("data-palette"),
    };
}

function reset() {
    const root = document.documentElement;
    root.classList.remove("dark", "black");
    root.removeAttribute("data-palette");
    localStorage.clear();
}

function withOs<T>(prefersDark: boolean, run: () => T): T {
    const original = window.matchMedia;
    window.matchMedia = (() => ({ matches: prefersDark })) as unknown as typeof window.matchMedia;
    try {
        return run();
    } finally {
        window.matchMedia = original;
    }
}

// Evaluated exactly as the page ships it, in global scope, over whatever is stored.
function bootstrap(raw: string | null, prefersDark: boolean) {
    reset();
    if (raw !== null) {
        localStorage.setItem(THEME_STORAGE_KEY, raw);
    }
    withOs(prefersDark, () => new Function(themeBootstrapScript())());
    return worn();
}

// What the app itself stamps once React is up, from the same stored value.
function afterMount(raw: string | null, prefersDark: boolean) {
    reset();
    const store = createThemeStore(memoryStore(raw === null ? {} : { [THEME_STORAGE_KEY]: raw }));
    withOs(prefersDark, () => applyTheme(store.load()));
    return worn();
}

// The inline pre-paint script must agree with the store and applyTheme: same key, same
// JSON format, same fallbacks. A disagreement is a flash — the page painted one way and
// then repainted the other when the app mounts.
describe("themeBootstrapScript", () => {
    afterEach(reset);

    it("paints a stored black violet theme before first paint", () => {
        const raw = JSON.stringify({ palette: "violet", mode: "black" });
        expect(bootstrap(raw, false)).toEqual({ dark: true, black: true, palette: "violet" });
    });

    it("keeps a stored light theme light even on a dark OS", () => {
        const raw = JSON.stringify({ palette: "indigo", mode: "light" });
        expect(bootstrap(raw, true)).toEqual({ dark: false, black: false, palette: "indigo" });
    });

    it("follows the OS in the default palette when nothing is stored", () => {
        expect(bootstrap(null, true)).toEqual({ dark: true, black: false, palette: "indigo" });
        expect(bootstrap(null, false)).toEqual({ dark: false, black: false, palette: "indigo" });
    });

    it("still falls back to the OS preference when the stored value is corrupt", () => {
        expect(bootstrap("not json", true)).toEqual({
            dark: true,
            black: false,
            palette: "indigo",
        });
    });

    it("paints what the app paints after mount, for anything a device could hold", () => {
        const theme = fc.record({
            palette: fc.oneof(fc.constantFrom(...PALETTES), fc.jsonValue()),
            mode: fc.oneof(fc.constantFrom(...MODES), fc.jsonValue()),
        });
        const raw = fc.oneof(
            fc.constant(null),
            theme.map((value) => JSON.stringify(value)),
            fc.constantFrom(...MODES).map((mode) => JSON.stringify(mode)),
            fc.jsonValue().map((value) => JSON.stringify(value) ?? "null"),
            fc.string(),
        );
        fc.assert(
            fc.property(raw, fc.boolean(), (stored, prefersDark) => {
                expect(bootstrap(stored, prefersDark)).toEqual(afterMount(stored, prefersDark));
            }),
        );
    });
});
