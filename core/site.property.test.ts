// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
    breadcrumbData,
    musicCompositionData,
    ogLocale,
    pageTitle,
    personImage,
    pieceImage,
    routeMeta,
    SITE_URL,
    webPageData,
    withTrailingSlash,
} from "./site";

// The addresses and the structured data the site declares about itself. Nothing here
// shows up on screen, which is exactly the problem: a URL that names the wrong page or
// a card that unfurls to nothing is invisible locally and costs weeks of indexing. The
// laws are the ones a crawler relies on — one canonical form per page, an absolute URL
// everywhere one is promised, and no value that reaches a crawler empty.

const arbPath = fc.oneof(
    fc.constantFrom("/", "/music/", "/play/abc/", "/person/chopin/", "/help", "/music"),
    fc
        .array(fc.stringMatching(/^[a-z0-9-]{1,8}$/), { minLength: 0, maxLength: 3 })
        .map((parts) => `/${parts.join("/")}`),
);
const arbQuery = fc.constantFrom("", "?tab=manage", "#section", "?a=1&b=2#frag", "?q=a/b");
const arbLocale = fc.constantFrom("en", "de", "fr", "sr", "pt", "zz");
const arbText = fc.string({ minLength: 1, maxLength: 30 });

// Every string a JSON-LD document carries, however deep — what a crawler actually reads.
const stringsIn = (value: unknown): string[] => {
    if (typeof value === "string") {
        return [value];
    }
    if (Array.isArray(value)) {
        return value.flatMap(stringsIn);
    }
    if (value && typeof value === "object") {
        return Object.values(value).flatMap(stringsIn);
    }
    return [];
};

describe("the one address a page answers at", () => {
    it("puts the slash on the path and nowhere else", () => {
        fc.assert(
            fc.property(arbPath, arbQuery, (path, tail) => {
                const href = withTrailingSlash(`${path}${tail}`);

                const mark = href.search(/[?#]/);
                const pathPart = mark === -1 ? href : href.slice(0, mark);
                expect(pathPart.endsWith("/")).toBe(true);
                // The query and fragment ride along untouched: a slash inside them
                // would name a different page than the one being linked.
                expect(mark === -1 ? "" : href.slice(mark)).toBe(tail);
            }),
        );
    });

    it("settles after one application", () => {
        fc.assert(
            fc.property(arbPath, arbQuery, (path, tail) => {
                const once = withTrailingSlash(`${path}${tail}`);

                // A canonical form that moved on a second pass would mean two URLs for
                // one page, which is the split this function exists to prevent.
                expect(withTrailingSlash(once)).toBe(once);
            }),
        );
    });
});

describe("what a link unfurls as", () => {
    it("brands every title and keeps the specific part in front", () => {
        fc.assert(
            fc.property(fc.array(arbText, { minLength: 1, maxLength: 3 }), (parts) => {
                const title = pageTitle(...parts);

                expect(title.endsWith("Plinky")).toBe(true);
                expect(title.startsWith(parts[0] as string)).toBe(true);
            }),
        );
    });

    it("keeps a piece's card inside the site's own image folder", () => {
        fc.assert(
            fc.property(fc.string({ minLength: 1, maxLength: 24 }), (id) => {
                for (const [url, folder] of [
                    [pieceImage(id), "/og/"],
                    [personImage(id), "/og/person/"],
                ] as const) {
                    const parsed = new URL(url);

                    expect(parsed.origin).toBe(SITE_URL);
                    // An id carrying a slash, a query or a traversal must not be able to
                    // point the card at another path — the encoding is what stops it.
                    expect(parsed.pathname.startsWith(folder)).toBe(true);
                    expect(parsed.pathname.endsWith(".png")).toBe(true);
                    expect(parsed.search).toBe("");
                    // One segment under the folder, and no segment that climbs out of
                    // it. A file NAMED "..png" is harmless; a segment that IS ".." is
                    // the traversal, and new URL would already have resolved it away,
                    // which is what makes the folder check above meaningful.
                    const segments = parsed.pathname.slice(folder.length).split("/");
                    expect(segments.length).toBe(1);
                    expect(segments).not.toContain("..");
                }
            }),
        );
    });

    it("gives a page a description and a card that say the same thing", () => {
        fc.assert(
            fc.property(arbText, arbText, (headline, description) => {
                const meta = routeMeta(headline, description);

                const title = meta.find((tag) => "title" in tag) as { title: string };
                expect(title.title).toBe(pageTitle(headline));
                const og = meta.filter((tag) => "property" in tag) as {
                    property: string;
                    content: string;
                }[];
                // The card's own title is the specific part without the brand, so what
                // a shared link shows is the page, not the site.
                expect(og.find((tag) => tag.property === "og:title")?.content).toBe(headline);
                expect(og.find((tag) => tag.property === "og:description")?.content).toBe(
                    description,
                );
            }),
        );
    });

    it("names a locale a crawler knows, whatever it is handed", () => {
        fc.assert(
            fc.property(fc.string({ maxLength: 10 }), (locale) => {
                expect(ogLocale(locale)).toMatch(/^[a-z]{2}_[A-Z]{2}$/);
            }),
        );
        for (const hazard of ["constructor", "toString", "__proto__"]) {
            expect(ogLocale(hazard)).toBe("en_US");
        }
    });
});

describe("the structured data a crawler reads", () => {
    it("declares an absolute, locale-correct address for a page", () => {
        fc.assert(
            fc.property(arbText, arbText, arbLocale, arbPath, (name, description, locale, path) => {
                const data = webPageData(name, description, locale, withTrailingSlash(path));

                expect(data["@context"]).toBe("https://schema.org");
                const url = new URL(data.url);
                expect(url.origin).toBe(SITE_URL);
                expect(url.pathname.startsWith(`/${locale}/`)).toBe(true);
                expect(data.inLanguage).toBe(locale);
            }),
        );
    });

    it("carries no empty value to a crawler", () => {
        fc.assert(
            fc.property(arbText, arbText, arbLocale, arbPath, (name, description, locale, path) => {
                const documents = [
                    webPageData(name, description, locale, withTrailingSlash(path)),
                    musicCompositionData(name, description, locale),
                    musicCompositionData(name, "", locale),
                ];

                for (const document of documents) {
                    // An empty string in JSON-LD is a claim about the page that says
                    // nothing — worse than the field being absent, which is what an
                    // unknown composer must be.
                    for (const value of stringsIn(document)) {
                        expect(value).not.toBe("");
                    }
                    expect(() => JSON.stringify(document)).not.toThrow();
                }
                expect("composer" in musicCompositionData(name, "", locale)).toBe(false);
            }),
        );
    });

    it("numbers a breadcrumb trail from one, in the order it is walked", () => {
        fc.assert(
            fc.property(
                arbLocale,
                fc.array(fc.tuple(arbText, arbPath), { minLength: 1, maxLength: 5 }),
                (locale, crumbs) => {
                    const trail = crumbs.map(([name, path]) => ({
                        name,
                        path: withTrailingSlash(path),
                    }));

                    const data = breadcrumbData(locale, trail);

                    data.itemListElement.forEach((item, at) => {
                        expect(item.position).toBe(at + 1);
                        expect(item.name).toBe(trail[at]?.name);
                        expect(new URL(item.item).origin).toBe(SITE_URL);
                    });
                },
            ),
        );
    });
});
