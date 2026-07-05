// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it, vi } from "vitest";
import { memoryStore } from "../adapters/memoryStore";
import { createThemeStore } from "./themeStore";

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
