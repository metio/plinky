// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
// @ts-expect-error - plain JS module; vitest resolves the source
import { buildSitemaps, pageUrl } from "./sitemap.mjs";

// The sitemap is the one artefact no gate can see the effect of: a wrong URL, a missing
// alternate or a page that contradicts its own robots meta all render as a perfectly valid
// file, and the failure arrives weeks later in Search Console. So the shape is pinned here,
// against fixture pages rather than a 26-locale build.

const SITE = "https://plinky.fun";
const LASTMOD = "2026-08-07";

const entries = (locales: string[], paths: string[]) =>
    locales.flatMap((locale) => paths.map((path) => ({ locale, path })));

const build = (options: Record<string, unknown> = {}) =>
    buildSitemaps({
        entries: entries(["en", "de", "fr"], ["/", "/about", "/settings"]),
        siteUrl: SITE,
        baseLocale: "en",
        lastmod: LASTMOD,
        noindex: ["/settings"],
        ...options,
    });

describe("pageUrl", () => {
    it("gives the locale index a bare trailing slash", () => {
        expect(pageUrl(SITE, "de", "/")).toBe("https://plinky.fun/de/");
    });

    it("keeps the trailing slash the prerendered document is served at", () => {
        // The document's own <link rel="canonical"> names this exact form; naming the
        // slashless one here would leave the sitemap and the page disagreeing about which
        // URL is real, and each locale's cluster would stop resolving.
        expect(pageUrl(SITE, "de", "/about")).toBe("https://plinky.fun/de/about/");
        expect(pageUrl(SITE, "en", "/play/K2k2MQKNlj6d")).toBe(
            "https://plinky.fun/en/play/K2k2MQKNlj6d/",
        );
    });
});

describe("buildSitemaps", () => {
    it("writes one child per locale, and an index naming each", () => {
        const { index, children } = build();

        expect([...children.keys()]).toEqual(["de", "en", "fr"]);
        for (const locale of ["de", "en", "fr"]) {
            expect(index).toContain(`<loc>${SITE}/sitemap-${locale}.xml</loc>`);
        }
    });

    it("stamps lastmod on every index entry as well as every URL", () => {
        const { index, children } = build();

        expect([...index.matchAll(/<lastmod>2026-08-07<\/lastmod>/g)]).toHaveLength(3);
        expect(children.get("en")).toContain(`<lastmod>${LASTMOD}</lastmod>`);
    });

    it("declares both namespaces the hreflang alternates need", () => {
        const { children } = build();

        expect(children.get("en")).toContain(
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
        );
    });

    it("leaves out every page whose own document forbids indexing", () => {
        const { children } = build();

        // Submitting a noindex page for indexing is a contradiction Search Console reports
        // as an error, and it is invisible from the sitemap itself — hence the check.
        for (const xml of children.values()) {
            expect(xml).not.toContain("/settings/");
        }
    });

    it("drops a noindex page from the alternates too, not just from its own <loc>", () => {
        // A page skipped only where it is the subject would still be advertised 25 times over
        // as another locale's alternate.
        const { children } = build({ noindex: ["/about"] });

        for (const xml of children.values()) {
            expect(xml).not.toContain("/about/");
        }
    });

    it("gives every URL the whole cluster, itself included", () => {
        const en = build().children.get("en") as string;
        const block = en.slice(en.indexOf("<url>"), en.indexOf("</url>"));

        // Self-reference: the URL a crawler is reading must appear among its own alternates,
        // or the cluster is asymmetric and the pages compete as duplicates instead.
        expect(block).toContain(`hreflang="en" href="${SITE}/en/"`);
        expect(block).toContain(`hreflang="de" href="${SITE}/de/"`);
        expect(block).toContain(`hreflang="fr" href="${SITE}/fr/"`);
    });

    it("points x-default at the base locale", () => {
        const { children } = build();

        expect(children.get("fr")).toContain(`hreflang="x-default" href="${SITE}/en/about/"`);
    });

    it("still emits an x-default when the base locale has no copy of the page", () => {
        const { children } = build({
            entries: entries(["de", "fr"], ["/about"]),
            noindex: [],
        });

        expect(children.get("de")).toContain(`hreflang="x-default" href="${SITE}/de/about/"`);
    });

    it("lists a locale's pages in a stable order, so a rebuild is not a diff", () => {
        const first = build().children.get("en");
        const shuffled = build({
            entries: entries(["fr", "en", "de"], ["/settings", "/about", "/"]),
        }).children.get("en");

        expect(shuffled).toBe(first);
    });

    it("escapes what XML cannot carry raw", () => {
        const { children } = build({
            entries: [{ locale: "en", path: "/play/a&b" }],
            noindex: [],
        });

        expect(children.get("en")).toContain("<loc>https://plinky.fun/en/play/a&amp;b/</loc>");
        expect(children.get("en")).not.toContain("a&b");
    });

    it("refuses a locale grown past the 50,000 URLs a sitemap may hold", () => {
        // The layout (one child per locale) has headroom for today's catalogue and none for
        // an unbounded one. Failing the build beats shipping a file search engines reject.
        const many = Array.from({ length: 50_001 }, (_, index) => ({
            locale: "en",
            path: `/play/${index}`,
        }));

        expect(() => build({ entries: many, noindex: [] })).toThrow(/50000/);
    });
});
