// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
// @ts-expect-error - plain JS module with a .d.mts declaration; vitest resolves the source
import { assertPages, noindexPaths, readPages, staticPaths } from "./pages.mjs";

// The page list is derived by reading app/routes.ts as text, because the Lighthouse config
// and the a11y sweep are plain Node and cannot import TypeScript. A text parse can quietly
// match nothing, which would hand every consumer an empty list and pass — so these pin the
// parse against the real route table.

describe("the derived page list", () => {
    it("reads the route table without complaint", () => {
        expect(() => assertPages()).not.toThrow();
    });

    it("finds the pages that exist, and the locale index as /", () => {
        const paths = staticPaths();

        expect(paths).toContain("/");
        expect(paths).toContain("/help");
        expect(paths).toContain("/glossary");
        // The two that were missing from the hand-kept prerender list until this was
        // derived — the failure the derivation exists to prevent.
        expect(paths).toContain("/placement");
        expect(paths).toContain("/collect");
    });

    it("leaves parameterised routes out of the static list", () => {
        // These prerender from real data (a score id, a composer slug), so a literal
        // "/play/:scoreId" in the list would be a 404 in the sitemap and an audited URL
        // that cannot load.
        const paths = staticPaths();

        expect(paths.some((path: string) => path.includes(":"))).toBe(false);
        expect(readPages().filter((page: { dynamic?: boolean }) => page.dynamic).length).toBe(2);
    });

    it("pairs every page with a route module that exists", () => {
        for (const page of readPages()) {
            if (page.module) {
                expect(`${page.path}: ${page.module}`).toMatch(/^\S+: routes\/\S+\.tsx$/);
            }
        }
    });

    it("finds more than a handful, so a parse that matched almost nothing fails", () => {
        // The specific number will drift as pages are added; the point is that an empty or
        // near-empty result is a broken parse, not a small app.
        expect(staticPaths().length).toBeGreaterThan(10);
    });
});

describe("the derived noindex list", () => {
    it("finds every page whose route declares noindexMeta()", () => {
        const paths = noindexPaths();

        // The legal notices and the personal/utility surfaces.
        for (const path of [
            "/impressum",
            "/datenschutz",
            "/stats",
            "/review",
            "/settings",
            "/basics",
            "/collect",
            "/placement",
        ]) {
            expect(paths).toContain(path);
        }
    });

    it("leaves the indexable pages out", () => {
        const paths = noindexPaths();

        for (const path of ["/", "/about", "/help", "/glossary", "/library", "/daily"]) {
            expect(paths).not.toContain(path);
        }
    });

    it("never returns an empty list, which would read as 'every page is indexable'", () => {
        // An empty result is what a renamed or reformatted call would produce, and it fails
        // open: the sitemap would advertise pages whose own documents forbid indexing.
        expect(noindexPaths().length).toBeGreaterThan(5);
    });

    it("agrees with a loose scan of the route modules", () => {
        // The precise match (`noindexMeta()`) and the loose one (the bare word) must pick out
        // the same pages. They diverge exactly when the call shape has moved on, which is the
        // drift assertPages() exists to refuse.
        const loose = readPages()
            .filter((page: { dynamic?: boolean; module: string }) => !page.dynamic && page.module)
            .filter((page: { module: string }) =>
                readFileSync(`app/${page.module}`, "utf8").includes("noindex"),
            )
            .map((page: { path: string }) => page.path);

        expect(noindexPaths().sort()).toEqual(loose.sort());
    });

    it("returns canonical paths in the same shape as staticPaths", () => {
        // The sitemap matches these against locale-stripped paths, so a bare "basics" here
        // would silently match nothing and leave the page in the sitemap.
        const paths = staticPaths();

        for (const path of noindexPaths()) {
            expect(path.startsWith("/")).toBe(true);
            expect(paths).toContain(path);
        }
    });
});
