// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";
import { isFavorite, loadFavorites, toggleFavorite } from "./favorites";

afterEach(() => localStorage.clear());

describe("favorites", () => {
    it("starts empty", () => {
        expect(loadFavorites().size).toBe(0);
        expect(isFavorite("twinkle")).toBe(false);
    });

    it("toggles a song on and off, persisting", () => {
        toggleFavorite("twinkle");
        expect(isFavorite("twinkle")).toBe(true);
        expect([...loadFavorites()]).toEqual(["twinkle"]);
        toggleFavorite("twinkle");
        expect(isFavorite("twinkle")).toBe(false);
        expect(loadFavorites().size).toBe(0);
    });

    it("returns the updated set from toggle", () => {
        expect([...toggleFavorite("a")]).toEqual(["a"]);
        expect([...toggleFavorite("b")].sort()).toEqual(["a", "b"]);
    });

    it("falls back to an empty set for corrupt data", () => {
        localStorage.setItem("plinky:favorites", "not json");
        expect(loadFavorites().size).toBe(0);
    });

    it("ignores non-string entries", () => {
        localStorage.setItem("plinky:favorites", JSON.stringify(["ok", 5, null]));
        expect([...loadFavorites()]).toEqual(["ok"]);
    });
});
