// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it } from "vitest";
import { parseBoard, parseBoardArtist, platformFor } from "./board";

const artist = {
    id: "a1",
    name: "Ada Keys",
    order: 1,
    text: "Plays a nocturne a day.",
    imageUrl: "https://cdn.sanity.io/ada.png",
    imageAlt: "Ada at the piano",
    linkUrl: "https://www.instagram.com/adakeys",
};

describe("parseBoardArtist", () => {
    it("accepts a full entry", () => {
        expect(parseBoardArtist(artist)).toEqual(artist);
    });

    it("rejects an entry without id or name", () => {
        expect(parseBoardArtist({ ...artist, id: "" })).toBeNull();
        expect(parseBoardArtist({ ...artist, name: "  " })).toBeNull();
        expect(parseBoardArtist(null)).toBeNull();
        expect(parseBoardArtist("nope")).toBeNull();
    });

    it("keeps an entry whose blurb is empty — a name, picture and link suffice", () => {
        expect(parseBoardArtist({ ...artist, text: "" })?.text).toBe("");
        expect(parseBoardArtist({ ...artist, text: undefined })?.text).toBe("");
    });

    it("trims the name", () => {
        expect(parseBoardArtist({ ...artist, name: "  Ada Keys " })?.name).toBe("Ada Keys");
    });

    it("drops a non-https image or link without discarding the artist", () => {
        const parsed = parseBoardArtist({
            ...artist,
            imageUrl: "http://insecure.example/x.png",
            linkUrl: "javascript:alert(1)",
        });
        expect(parsed).not.toBeNull();
        expect(parsed?.imageUrl).toBeUndefined();
        expect(parsed?.imageAlt).toBeUndefined();
        expect(parsed?.linkUrl).toBeUndefined();
    });

    it("defaults a missing or unusable order to 0", () => {
        expect(parseBoardArtist({ ...artist, order: undefined })?.order).toBe(0);
        expect(parseBoardArtist({ ...artist, order: Number.NaN })?.order).toBe(0);
    });
});

describe("parseBoard", () => {
    it("skips malformed entries and sorts by order, ties in arrival order", () => {
        const parsed = parseBoard([
            { ...artist, id: "late", order: 5 },
            { id: "", name: "x", text: "x" },
            { ...artist, id: "first", order: 1 },
            { ...artist, id: "second", order: 1 },
        ]);
        expect(parsed.map((entry) => entry.id)).toEqual(["first", "second", "late"]);
    });

    it("yields nothing for a non-array input", () => {
        expect(parseBoard(null)).toEqual([]);
        expect(parseBoard({})).toEqual([]);
    });
});

describe("platformFor", () => {
    it("recognizes the platforms the board can badge, subdomains included", () => {
        expect(platformFor("https://www.instagram.com/adakeys")).toBe("instagram");
        expect(platformFor("https://www.tiktok.com/@adakeys")).toBe("tiktok");
        expect(platformFor("https://m.youtube.com/@adakeys")).toBe("youtube");
        expect(platformFor("https://youtu.be/xyz")).toBe("youtube");
        expect(platformFor("https://x.com/adakeys")).toBe("x");
        expect(platformFor("https://twitter.com/adakeys")).toBe("x");
        expect(platformFor("https://bsky.app/profile/adakeys")).toBe("bluesky");
        expect(platformFor("https://www.threads.com/@adakeys")).toBe("threads");
    });

    it("returns null for unknown hosts, lookalikes, and unparsable input", () => {
        expect(platformFor("https://adakeys.example.com")).toBeNull();
        expect(platformFor("https://notinstagram.com/adakeys")).toBeNull();
        expect(platformFor("not a url")).toBeNull();
    });
});
