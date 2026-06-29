// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { buildPrintDocument, fileStem, printViaIframe } from "./printScore";

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

describe("printViaIframe", () => {
    afterEach(() => {
        vi.restoreAllMocks();
        vi.useRealTimers();
        for (const frame of document.body.querySelectorAll("iframe")) {
            frame.remove();
        }
    });

    it("writes the page into a hidden iframe and triggers its print dialog", () => {
        vi.useFakeTimers();
        const print = vi.fn();
        const write = vi.fn();
        const fakeWindow = {
            document: { open: vi.fn(), write, close: vi.fn() },
            focus: vi.fn(),
            print,
            addEventListener: vi.fn(),
        };
        vi.spyOn(HTMLIFrameElement.prototype, "contentWindow", "get").mockReturnValue(
            fakeWindow as unknown as Window,
        );
        printViaIframe(buildPrintDocument("<svg><rect/></svg>", "Minuet"));
        // The staff page is written into the frame and its print dialog opened — the
        // path Print takes when window.open is blocked, so it can't silently no-op.
        expect(write).toHaveBeenCalledWith(expect.stringContaining("<svg><rect/></svg>"));
        expect(print).toHaveBeenCalled();
        // The frame tidies itself up on the safety timer when afterprint never fires.
        expect(document.body.querySelector("iframe")).not.toBeNull();
        vi.runOnlyPendingTimers();
        expect(document.body.querySelector("iframe")).toBeNull();
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
