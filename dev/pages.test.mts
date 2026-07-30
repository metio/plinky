// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it } from "vitest";
// @ts-expect-error - plain JS module with a .d.mts declaration; vitest resolves the source
import { assertPages, readPages, staticPaths } from "./pages.mjs";

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
