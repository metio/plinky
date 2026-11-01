// SPDX-FileCopyrightText: The Klimpi Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { MAX_URLS, changedPieces, changedUrls, submissions } from "./indexnow.mjs";

const PAGES = [
    { path: "/", module: "routes/home.tsx" },
    { path: "/about", module: "routes/about.tsx" },
    { path: "/music", module: "routes/music.tsx" },
];
const LOCALES = ["en", "de"];
const SITE = "https://klimpi.app";

const urls = (changed: string[], pieces: string[] = []) =>
    changedUrls({ changed, pages: PAGES, pieces, locales: LOCALES, siteUrl: SITE });

describe("what a push tells the search engines about", () => {
    it("names a changed page in every language", () => {
        expect(urls(["app/routes/about.tsx"])).toEqual([
            "https://klimpi.app/en/about/",
            "https://klimpi.app/de/about/",
        ]);
    });

    it("names the locale root with one slash, not two", () => {
        expect(urls(["app/routes/home.tsx"])).toEqual([
            "https://klimpi.app/en/",
            "https://klimpi.app/de/",
        ]);
    });

    it("names every page of a language whose strings changed, and no other language", () => {
        const found = urls(["messages/de.json"]);
        expect(found).toHaveLength(PAGES.length);
        expect(found.every((url: string) => url.startsWith("https://klimpi.app/de/"))).toBe(true);
    });

    it("says nothing for a language the site does not speak", () => {
        expect(urls(["messages/fr.json"])).toEqual([]);
    });

    it("says nothing for the files that rewrite no page's content", () => {
        // A hook, a store, a component, a test, the workflow itself. Submitting the whole
        // site because one of these moved is the noise the protocol asks not to send —
        // and an endpoint fed that on every push learns to ignore the site.
        expect(
            urls([
                "app/hooks/usePrefs.ts",
                "app/stores/favorites.ts",
                "app/components/ui/button.tsx",
                "core/site.ts",
                ".github/workflows/website.yml",
                "README.md",
            ]),
        ).toEqual([]);
    });

    it("names a piece's page in every language when its row changed", () => {
        expect(urls([], ["abc"])).toEqual([
            "https://klimpi.app/en/play/abc/",
            "https://klimpi.app/de/play/abc/",
        ]);
    });

    it("names each address once however many ways it was reached", () => {
        const found = urls(["app/routes/about.tsx", "messages/en.json"]);
        expect(new Set(found).size).toBe(found.length);
    });
});

describe("which catalogue rows changed", () => {
    const row = (id: string, title: string) => ({ id, title, composer: "A" });

    it("names a piece the catalogue gained", () => {
        expect(changedPieces([row("a", "A")], [row("a", "A"), row("b", "B")])).toEqual(["b"]);
    });

    it("names a piece whose row was rewritten", () => {
        expect(changedPieces([row("a", "A")], [row("a", "Corrected")])).toEqual(["a"]);
    });

    it("names nothing when nothing moved", () => {
        expect(changedPieces([row("a", "A")], [row("a", "A")])).toEqual([]);
    });

    it("names nothing for a piece that left, since it has no page to recrawl", () => {
        expect(changedPieces([row("a", "A"), row("b", "B")], [row("a", "A")])).toEqual([]);
    });

    it("copes with a manifest that could not be read", () => {
        expect(changedPieces(null, [row("a", "A")])).toEqual(["a"]);
        expect(changedPieces([row("a", "A")], null)).toEqual([]);
    });
});

describe("the submissions themselves", () => {
    it("makes none for an empty set", () => {
        expect(submissions([], { host: "klimpi.app" })).toEqual([]);
    });

    it("carries the key where the engine will look for it", () => {
        const [first] = submissions(["https://klimpi.app/en/"], { host: "klimpi.app", key: "k" });
        expect(first).toEqual({
            host: "klimpi.app",
            key: "k",
            keyLocation: "https://klimpi.app/k.txt",
            urlList: ["https://klimpi.app/en/"],
        });
    });

    it("splits at the ten thousand a submission may carry", () => {
        const many = Array.from(
            { length: MAX_URLS + 5 },
            (_, index) => `https://klimpi.app/${index}`,
        );
        const batches = submissions(many, { host: "klimpi.app" });
        expect(batches).toHaveLength(2);
        expect(batches[0]?.urlList).toHaveLength(MAX_URLS);
        expect(batches[1]?.urlList).toHaveLength(5);
    });
});
