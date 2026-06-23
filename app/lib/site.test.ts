// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it } from "vitest";
import { pageTitle, routeMeta } from "./site";

describe("pageTitle", () => {
    it("ends with the brand and leads with the specific part", () => {
        expect(pageTitle("Sight-reading sprint")).toBe("Sight-reading sprint · Plinky");
        expect(pageTitle("C major scale", "Practice")).toBe("C major scale · Practice · Plinky");
    });
});

describe("routeMeta", () => {
    it("brands the title and mirrors the headline in the social tags", () => {
        const tags = routeMeta("Ear training", "Hear a note and play it back") as Record<
            string,
            string
        >[];
        expect(tags.find((tag) => tag.title)?.title).toBe("Ear training · Plinky");
        expect(tags.find((tag) => tag.property === "og:title")?.content).toBe("Ear training");
        expect(tags.find((tag) => tag.name === "twitter:description")?.content).toBe(
            "Hear a note and play it back",
        );
    });
});
