// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it } from "vitest";
import { slugify } from "./slug";

describe("slugify", () => {
    it("lowercases and hyphenates a title", () => {
        expect(slugify("Minuet in G")).toBe("minuet-in-g");
    });

    it("collapses runs of punctuation and trims the ends", () => {
        expect(slugify("  Für Elise!  ")).toBe("f-r-elise");
        expect(slugify("A -- B")).toBe("a-b");
    });

    it("falls back to 'score' when nothing survives", () => {
        expect(slugify("！？")).toBe("score");
        expect(slugify("")).toBe("score");
    });
});
