// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
    countRules,
    DYNAMIC_RULE_LIMIT,
    readRetired,
    redirectRules,
    STATIC_RULE_LIMIT,
    writeRedirects,
} from "./gen-redirects.mjs";
import { dynamicPrefixes, staticPaths } from "./pages.mjs";

describe("redirectRules", () => {
    const rules = redirectRules(
        [
            { from: "/you", to: "/stats" },
            { from: "/loop/*", to: "/play/*" },
        ],
        ["/", "/music"],
        ["/play"],
    );

    it("sends a retired page on in every language, with and without the slash", () => {
        expect(rules).toContain("/:locale/you /:locale/stats/ 301");
        expect(rules).toContain("/:locale/you/ /:locale/stats/ 301");
        expect(rules).toContain("/you /en/stats/ 301");
        expect(rules).toContain("/you/ /en/stats/ 301");
    });

    it("carries what followed a retired trainer onto the play page", () => {
        expect(rules).toContain("/:locale/loop/* /:locale/play/:splat 301");
        expect(rules).toContain("/loop/* /en/play/:splat 301");
    });

    it("sends an address with no language to the English page, and leaves the root alone", () => {
        expect(rules).toContain("/music /en/music/ 301");
        expect(rules).toContain("/music/ /en/music/ 301");
        expect(rules).toContain("/play/* /en/play/:splat 301");
        expect(rules.some((rule) => rule.startsWith("/ "))).toBe(false);
    });
});

describe("the table the deploy writes", () => {
    it("names only pages that exist now as destinations", () => {
        const pages = new Set([...staticPaths(), ...dynamicPrefixes()]);
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

    it("stays inside Cloudflare's rule limits and writes the file", () => {
        const out = mkdtempSync(join(tmpdir(), "plinky-redirects-"));
        const { dynamic, fixed } = writeRedirects(out);
        expect(dynamic).toBeLessThanOrEqual(DYNAMIC_RULE_LIMIT);
        expect(fixed).toBeLessThanOrEqual(STATIC_RULE_LIMIT);
        const written = readFileSync(`${out}/_redirects`, "utf8");
        expect(written).toContain("/:locale/you /:locale/stats/ 301");
        expect(countRules(written.split("\n").filter((l) => l && !l.startsWith("#")))).toEqual({
            dynamic,
            fixed,
        });
    });
});
