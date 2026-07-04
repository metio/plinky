// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it } from "vitest";
import { musicCompositionData, ogLocale, pageTitle, routeMeta, structuredData } from "./site";

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

describe("ogLocale", () => {
    it("maps an app locale to an Open Graph language_TERRITORY code", () => {
        expect(ogLocale("de")).toBe("de_DE");
        expect(ogLocale("en")).toBe("en_US");
        // An unknown locale falls back rather than emitting a bare code.
        expect(ogLocale("zz")).toBe("en_US");
    });
});

describe("structuredData", () => {
    it("declares the page's language and stays free/accessible", () => {
        const data = structuredData("de");
        expect(data.inLanguage).toBe("de");
        expect(data["@type"]).toBe("WebApplication");
        expect(data.isAccessibleForFree).toBe(true);
        expect(data.offers.price).toBe("0");
    });
});

describe("musicCompositionData", () => {
    it("describes the piece, including the composer when present", () => {
        const data = musicCompositionData("Ode to Joy", "Beethoven", "de");
        expect(data["@type"]).toBe("MusicComposition");
        expect(data.name).toBe("Ode to Joy");
        expect(data.inLanguage).toBe("de");
        expect(data.composer).toEqual({ "@type": "Person", name: "Beethoven" });
    });

    it("omits the composer when unknown", () => {
        expect(musicCompositionData("Etude", "", "en")).not.toHaveProperty("composer");
    });
});
