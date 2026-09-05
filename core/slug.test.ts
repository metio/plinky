// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { slugify } from "./slug";

describe("slugify", () => {
    it("lowercases and hyphenates a title", () => {
        expect(slugify("Minuet in G")).toBe("minuet-in-g");
    });

    it("collapses runs of punctuation and trims the ends", () => {
        expect(slugify("  Minuet -- in G!  ")).toBe("minuet-in-g");
        expect(slugify("A -- B")).toBe("a-b");
    });

    it("keeps an accented letter as its plain one rather than a gap", () => {
        expect(slugify("Für Elise")).toBe("fur-elise");
        expect(slugify("Étude")).toBe("etude");
        expect(slugify("Dvořák")).toBe("dvorak");
    });

    it("reads as the fallback when nothing survives, and as nothing without one", () => {
        expect(slugify("！？", "score")).toBe("score");
        expect(slugify("", "score")).toBe("score");
        expect(slugify("！？")).toBe("");
    });
});
