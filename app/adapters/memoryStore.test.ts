// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it } from "vitest";
import { memoryStore } from "./memoryStore";

describe("memoryStore", () => {
    it("round-trips get/set/remove", () => {
        const store = memoryStore();
        expect(store.get("a")).toBeNull();
        store.set("a", "1");
        expect(store.get("a")).toBe("1");
        store.remove("a");
        expect(store.get("a")).toBeNull();
    });

    it("stands in for a store that already holds state via the seed", () => {
        const store = memoryStore({ "plinky:prefs": "{}", "plinky:theme": "dark" });
        expect(store.get("plinky:theme")).toBe("dark");
        expect(store.keys().sort()).toEqual(["plinky:prefs", "plinky:theme"]);
    });

    it("keeps stores independent", () => {
        const a = memoryStore({ k: "1" });
        const b = memoryStore();
        a.set("k", "2");
        expect(b.get("k")).toBeNull();
    });
});
