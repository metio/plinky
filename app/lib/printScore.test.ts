// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it } from "vitest";
import { buildPrintDocument, fileStem } from "./printScore";

describe("buildPrintDocument", () => {
    it("wraps the score's SVG in a standalone printable page", () => {
        const doc = buildPrintDocument("<svg><rect/></svg>", "Minuet");
        expect(doc.startsWith("<!doctype html>")).toBe(true);
        expect(doc).toContain("<title>Minuet</title>");
        expect(doc).toContain("<svg><rect/></svg>");
        expect(doc).toContain("@media print");
    });

    it("strips markup characters from the title so it can't break the page", () => {
        const doc = buildPrintDocument("<svg/>", "<script>x</script>");
        expect(doc).not.toContain("<script>");
        expect(doc).toContain("<title>scriptx/script</title>");
    });
});

describe("fileStem", () => {
    it("lowercases and hyphenates a title for a filename", () => {
        expect(fileStem("Twinkle Twinkle")).toBe("twinkle-twinkle");
    });

    it("collapses punctuation and trims stray hyphens", () => {
        expect(fileStem("Für Elise!")).toBe("f-r-elise");
    });

    it("falls back to a default when nothing usable remains", () => {
        expect(fileStem("???")).toBe("score");
    });
});
