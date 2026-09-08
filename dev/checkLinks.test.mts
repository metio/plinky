// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { checkLinks, complaint, findRedirectingLinks, internalLinks } from "./check-links.mjs";

const LOCALES = ["en", "de"];

describe("which links a document points out of itself with", () => {
    it("takes the ones that stay on the site", () => {
        expect(
            internalLinks(
                '<a href="/en/music/">m</a><a href="https://example.test/">x</a><a href="#top">t</a>',
            ),
        ).toEqual(["/en/music/"]);
    });

    it("drops the fragment and the query, which name the same page", () => {
        expect(internalLinks('<a href="/en/glossary/?symbol=slur#mark">s</a>')).toEqual([
            "/en/glossary/",
        ]);
    });

    it("leaves the files alone — a font has no slash to add", () => {
        expect(
            internalLinks('<link href="/assets/inter.woff2"/><img src="x"><a href="/og.png">o</a>'),
        ).toEqual([]);
    });
});

describe("whether a link names the address that answers", () => {
    it("is content with a language and a slash", () => {
        expect(complaint("/en/music/", LOCALES)).toBeNull();
        expect(complaint("/de/play/abc/", LOCALES)).toBeNull();
    });

    it("names the missing slash, which the host redirects for", () => {
        expect(complaint("/en/music", LOCALES)).toMatch(/trailing slash/);
    });

    it("names the missing language", () => {
        expect(complaint("/music/", LOCALES)).toMatch(/no language/);
    });

    it("leaves the bare root alone, which is the language chooser", () => {
        // It redirects on purpose, and a page linking there is linking to the chooser.
        expect(complaint("/", LOCALES)).toBeNull();
    });
});

describe("the tree about to be uploaded", () => {
    const tree = () => {
        const out = mkdtempSync(join(tmpdir(), "plinky-links-"));
        mkdirSync(join(out, "en", "music"), { recursive: true });
        writeFileSync(join(out, "settings.json"), JSON.stringify({ locales: LOCALES }));
        return out;
    };

    it("passes a tree whose links all name the address that answers", () => {
        const out = tree();
        writeFileSync(join(out, "en", "music", "index.html"), '<a href="/en/play/abc/">p</a>');
        expect(() => checkLinks(out, join(out, "settings.json"))).not.toThrow();
    });

    it("says which link, and where, and what to build it with", () => {
        const out = tree();
        writeFileSync(join(out, "en", "music", "index.html"), '<a href="/music">m</a>');
        expect(() => checkLinks(out, join(out, "settings.json"))).toThrow(/localizedHref/);
        expect(findRedirectingLinks(out, LOCALES)).toEqual([
            {
                file: join(out, "en", "music", "index.html"),
                href: "/music",
                why: expect.any(String),
            },
        ]);
    });

    it("counts one address once however often a page repeats it", () => {
        const out = tree();
        writeFileSync(
            join(out, "en", "music", "index.html"),
            '<a href="/music">m</a><a href="/music">m again</a>',
        );
        expect(findRedirectingLinks(out, LOCALES)).toHaveLength(1);
    });
});
