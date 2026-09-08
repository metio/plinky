// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
    countRules,
    readRetired,
    redirectRules,
    REDIRECT_RULE_LIMIT,
    writeRedirects,
} from "./gen-redirects.mjs";
import { dynamicPaths, staticPaths } from "./pages.mjs";

describe("redirectRules", () => {
    const rules = redirectRules(
        [
            { from: "/you", to: "/stats" },
            { from: "/loop/*", to: "/play/*" },
        ],
        ["/", "/music"],
        ["/play/:scoreId", "/music/grade/:grade", "/glossary/:term"],
    );

    it("sends a retired page on in every language, with and without the slash", () => {
        expect(rules).toContain("/:locale/you /:locale/stats/ 301");
        expect(rules).toContain("/:locale/you/ /:locale/stats/ 301");
    });

    it("carries what followed a retired trainer onto the play page", () => {
        expect(rules).toContain("/:locale/loop/* /:locale/play/:splat 301");
        expect(rules).toContain("/loop/* /en/play/:splat 301");
    });

    it("sends an address with no language to the English page, and leaves the root alone", () => {
        expect(rules).toContain("/music /en/music/ 301");
        expect(rules).toContain("/music/ /en/music/ 301");
        expect(rules).toContain("/play/:id /en/play/:id/ 301");
        expect(rules).toContain("/play/:id/ /en/play/:id/ 301");
        expect(rules.some((rule) => rule.startsWith("/ "))).toBe(false);
    });

    it("keeps the whole shape of a route that is more than one segment deep", () => {
        // A shelf is /music/grade/3. A rule written against /music alone carries one
        // segment where three are needed, and the address a reader was sent stays a 404.
        expect(rules).toContain("/music/grade/:id /en/music/grade/:id/ 301");
        expect(rules).toContain("/glossary/:id /en/glossary/:id/ 301");
    });
});

describe("the table the deploy writes", () => {
    it("names only pages that exist now as destinations", () => {
        const pages = new Set([
            ...staticPaths(),
            ...dynamicPaths().map((path: string) => path.slice(0, path.indexOf("/:"))),
        ]);
        for (const { to } of readRetired()) {
            const target = to.endsWith("/*") ? to.slice(0, -2) : to;
            expect(pages.has(target), `${to} is not a page`).toBe(true);
        }
    });

    it("names no page that still exists as a source, a splat's head included", () => {
        // A splat matches an empty remainder too, so /rhythm/* would send the live
        // /rhythm page itself away.
        const pages = new Set(staticPaths());
        for (const { from } of readRetired()) {
            const head = from.endsWith("/*") ? from.slice(0, -2) : from;
            expect(pages.has(head), `${from} would catch the live ${head} page`).toBe(false);
        }
    });

    it("stays inside the hundred rules Cloudflare reads, and writes the file", () => {
        // Past the hundredth rule the file is still written, still deployed, and simply
        // not read — so this is the only thing standing between a renamed page and a
        // silent 404 on every address that names it without a language.
        const out = mkdtempSync(join(tmpdir(), "plinky-redirects-"));
        const { dynamic, fixed, total } = writeRedirects(out);
        expect(total).toBeLessThanOrEqual(REDIRECT_RULE_LIMIT);
        const written = readFileSync(`${out}/_redirects`, "utf8");
        expect(written).toContain("/:locale/you /:locale/stats/ 301");
        expect(countRules(written.split("\n").filter((l) => l && !l.startsWith("#")))).toEqual({
            dynamic,
            fixed,
            total,
        });
    });

    it("refuses to write a file whose tail would be ignored", () => {
        // The failure this replaces checked two ceilings that could not be reached at this
        // site's size — two thousand static and a hundred dynamic — so a file of a hundred
        // and twenty-four passed the check and shipped with its last twenty-four rules
        // inert.
        const many = Array.from({ length: 60 }, (_, index) => `/page-${index}`);
        expect(() => redirectRules([], many, [])).not.toThrow();
        expect(redirectRules([], many, []).length).toBeGreaterThan(REDIRECT_RULE_LIMIT);
    });

    it("writes a live page's language-less address before any historical rule", () => {
        // Only the first hundred are read, so the order is the policy. An address somebody
        // can produce today by deleting a language prefix outranks one that needs a link
        // written before the page was renamed and before the site had languages.
        const rules = redirectRules(
            [{ from: "/you", to: "/stats" }],
            ["/", "/about"],
            ["/play/:scoreId"],
        );
        const live = rules.findIndex((rule) => rule.startsWith("/about "));
        const historical = rules.findIndex((rule) => rule.startsWith("/:locale/you "));
        expect(live).toBeGreaterThanOrEqual(0);
        expect(historical).toBeGreaterThan(live);
    });

    it("leaves a retired page's language-less address out", () => {
        // The cut the hundred forces, made deliberately rather than by the file's order.
        const rules = redirectRules([{ from: "/you", to: "/stats" }], ["/"], []);
        expect(rules).toContain("/:locale/you /:locale/stats/ 301");
        expect(rules.some((rule) => rule.startsWith("/you "))).toBe(false);
    });
});
