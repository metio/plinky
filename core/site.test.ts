// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it } from "vitest";
import {
    breadcrumbData,
    musicCompositionData,
    noindexMeta,
    ogLocale,
    pageTitle,
    personData,
    routeMeta,
    structuredData,
} from "./site";

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

describe("noindexMeta", () => {
    it("marks the page noindex but still crawlable for its links", () => {
        expect(noindexMeta()).toEqual({ name: "robots", content: "noindex, follow" });
    });
});

describe("personData", () => {
    it("describes the composer and lists their pieces with locale-prefixed URLs", () => {
        const data = personData(
            {
                slug: "frederic-chopin",
                name: "Frédéric Chopin",
                pieces: [
                    { id: "abc", title: "Prelude in E minor" },
                    { id: "def", title: "Nocturne" },
                ],
            },
            "de",
        );
        expect(data["@type"]).toBe("Person");
        expect(data.name).toBe("Frédéric Chopin");
        expect(data.url).toBe("https://plinky.fun/de/person/frederic-chopin/");
        expect(data.subjectOf.numberOfItems).toBe(2);
        expect(data.subjectOf.itemListElement[0]).toEqual({
            "@type": "ListItem",
            position: 1,
            url: "https://plinky.fun/de/play/abc/",
            name: "Prelude in E minor",
        });
    });
});

describe("breadcrumbData", () => {
    it("numbers the trail and makes each crumb a locale-prefixed URL", () => {
        const data = breadcrumbData("en", [
            { name: "Home", path: "/" },
            { name: "Library", path: "/library/" },
            { name: "Chopin", path: "/person/frederic-chopin/" },
        ]);
        expect(data["@type"]).toBe("BreadcrumbList");
        expect(data.itemListElement.map((crumb) => crumb.position)).toEqual([1, 2, 3]);
        expect(data.itemListElement[0]?.item).toBe("https://plinky.fun/en/");
        expect(data.itemListElement[2]?.item).toBe(
            "https://plinky.fun/en/person/frederic-chopin/",
        );
    });
});
