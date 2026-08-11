// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { clickInfo } from "./analyticsClick";

describe("clickInfo", () => {
    it("prefers an explicit data-analytics label over everything else", () => {
        expect(
            clickInfo({ dataAnalytics: "save-take", ariaLabel: "Save", text: "Save", tag: "button" }),
        ).toEqual({ label: "save-take", control: "button" });
    });

    it("falls back to the accessible name, then the visible text, then the title", () => {
        expect(clickInfo({ ariaLabel: "Close", tag: "button" })?.label).toBe("Close");
        expect(clickInfo({ text: "Practice", tag: "button" })?.label).toBe("Practice");
        expect(clickInfo({ title: "More", tag: "a" })?.label).toBe("More");
        expect(clickInfo({ tag: "summary" })?.label).toBe("summary");
    });

    it("reports the ARIA role as the control kind, else the tag", () => {
        expect(clickInfo({ ariaLabel: "Keep up", role: "switch", tag: "button" })?.control).toBe(
            "switch",
        );
        expect(clickInfo({ text: "Home", tag: "a" })?.control).toBe("a");
    });

    it("collapses whitespace and caps a long label", () => {
        const long = "word ".repeat(40);
        const info = clickInfo({ text: long, tag: "button" });
        expect(info?.label.length).toBeLessThanOrEqual(80);
        expect(info?.label).not.toContain("  ");
    });

    it("returns null when nothing but blank strings identify the control", () => {
        expect(clickInfo({ ariaLabel: "   ", text: "\n", tag: "" })).toBeNull();
    });
});
