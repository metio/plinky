// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import { svgMilestone } from "./milestoneCard";

const parse = (svg: string) => new DOMParser().parseFromString(svg, "image/svg+xml");

describe("svgMilestone", () => {
    it("produces a well-formed portrait card carrying the title and detail", () => {
        const doc = parse(svgMilestone({ title: "Grade 5", detail: "Skill 1840" }));
        expect(doc.querySelector("parsererror")).toBeNull();
        const svg = doc.querySelector("svg");
        expect(svg?.getAttribute("width")).toBe("1080");
        expect(svg?.getAttribute("height")).toBe("1350");
        const texts = [...doc.querySelectorAll("text")].map((t) => t.textContent);
        expect(texts).toContain("Grade 5");
        expect(texts).toContain("Skill 1840");
        expect(texts).toContain("plinky.fun");
    });

    it("omits the detail line when there is none", () => {
        const doc = parse(svgMilestone({ title: "100-day streak" }));
        const texts = [...doc.querySelectorAll("text")].map((t) => t.textContent);
        expect(texts).toContain("100-day streak");
        expect(texts).not.toContain("Skill");
    });

    it("escapes markup in the title", () => {
        const svg = svgMilestone({ title: "A & B <c>" });
        expect(svg).toContain("A &amp; B &lt;c&gt;");
    });
});
