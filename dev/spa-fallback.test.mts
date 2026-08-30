// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { dynamicPrefixes } from "./pages.mjs";
import { ROUTE_RULE_LIMIT, routeRules, writeSpaFallback } from "./spa-fallback.mjs";

const LOCALES: string[] = JSON.parse(readFileSync("project.inlang/settings.json", "utf8")).locales;

describe("routeRules", () => {
    it("covers every dynamic route in every language", () => {
        const { include } = routeRules(LOCALES, ["/play", "/person"]);
        expect(include).toHaveLength(LOCALES.length * 2);
        for (const locale of LOCALES) {
            expect(include).toContain(`/${locale}/play/*`);
            expect(include).toContain(`/${locale}/person/*`);
        }
    });

    it("names the routes the app actually declares", () => {
        // The prefixes are read from app/routes.ts, so this pins the reading rather than a
        // copy of it: a dynamic route added to the table has to show up here.
        expect(dynamicPrefixes().toSorted()).toEqual(["/person", "/play"]);
    });

    it("stays inside Cloudflare's rule cap for the languages actually shipped", () => {
        expect(routeRules(LOCALES, dynamicPrefixes()).include.length).toBeLessThanOrEqual(
            ROUTE_RULE_LIMIT,
        );
    });

    it("refuses to emit a truncated rule set", () => {
        // Silently dropping rules past the cap would restore the 404s for whichever
        // languages fell off the end, which is the failure this whole file exists to stop.
        const tooMany = Array.from({ length: 60 }, (_, index) => `l${index}`);
        expect(() => routeRules(tooMany, ["/play", "/person"])).toThrow(/Cloudflare allows 100/);
    });

    it("refuses to emit nothing when the route table stops parsing", () => {
        expect(() => routeRules(LOCALES, [])).toThrow(/no dynamic routes/);
    });

    it("scopes the rules so an absent file keeps its 404", () => {
        // The middleware turns 404 into 200 wherever it runs, so where it runs is the
        // whole safety argument: a missing image must stay missing.
        const { include } = routeRules(LOCALES, dynamicPrefixes());
        expect(include.every((rule) => /^\/[a-z-]+\/(play|person)\/\*$/.test(rule))).toBe(true);
        expect(include).not.toContain("/*");
    });
});

describe("writeSpaFallback", () => {
    it("writes the shell and the route rules into the build output", () => {
        const out = mkdtempSync(join(tmpdir(), "plinky-spa-"));
        writeFileSync(`${out}/__spa-fallback.html`, "<!doctype html><title>shell</title>");

        const { rules } = writeSpaFallback(out);

        expect(readFileSync(`${out}/404.html`, "utf8")).toContain("shell");
        const routes = JSON.parse(readFileSync(`${out}/_routes.json`, "utf8"));
        expect(routes.version).toBe(1);
        expect(routes.include).toHaveLength(rules);
        expect(routes.include).toContain("/en/play/*");
    });

    it("fails when the build emitted no shell to fall back to", () => {
        // An empty 404.html would be a blank page for every catalogue piece, so a missing
        // fallback has to stop the deploy rather than produce one.
        const out = mkdtempSync(join(tmpdir(), "plinky-spa-"));
        expect(existsSync(`${out}/__spa-fallback.html`)).toBe(false);
        expect(() => writeSpaFallback(out)).toThrow(/emitted no SPA fallback/);
    });
});
