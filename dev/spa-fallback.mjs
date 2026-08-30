// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What the deploy adds so an undocumented page still answers correctly.
//
// Two files, written together because they are two halves of one decision:
//
//   404.html      the SPA shell, so a path with no prerendered document still renders
//                 the page once the client router has matched it.
//   _routes.json  the paths where functions/_middleware.js runs, so that shell is served
//                 with a 200 rather than the 404 Pages would otherwise attach to it.
//
// Both used to be a `cp` line repeated in two workflows. The copy was in both; the status
// correction was in neither, which is the bug this closes — a reader saw the page, a
// crawler was told it was gone, and nothing in the build could tell the difference.
//
// The route prefixes come from app/routes.ts (via dev/pages.mjs) and the languages from
// the inlang settings, so neither is a list anybody maintains here.

import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { assertPages, dynamicPrefixes } from "./pages.mjs";

const OUT = "build/client";

// Cloudflare's cap on include + exclude rules combined. Twenty-six languages times two
// dynamic routes is fifty-two, so there is room for one more route and not for three —
// hence a check rather than a comment. Rules dropped past the cap would put the bug
// straight back for whichever languages fell off the end, and say nothing while doing it.
export const ROUTE_RULE_LIMIT = 100;

// One rule per language per dynamic route. Narrow on purpose: the middleware turns a 404
// into a 200, and a 404 is the right answer nearly everywhere else — a missing image is
// missing, and saying so is not a bug to fix.
export function routeRules(locales, prefixes) {
    if (prefixes.length === 0) {
        throw new Error(
            "app/routes.ts declares no dynamic routes — either the table changed shape " +
                "or dev/pages.mjs can no longer read it; without prefixes every " +
                "catalogue page keeps its 404",
        );
    }
    const include = locales.flatMap((locale) => prefixes.map((prefix) => `/${locale}${prefix}/*`));
    if (include.length > ROUTE_RULE_LIMIT) {
        throw new Error(
            `_routes.json would need ${include.length} rules (${locales.length} languages ` +
                `x ${prefixes.length} dynamic routes) and Cloudflare allows ${ROUTE_RULE_LIMIT}`,
        );
    }
    return { version: 1, include, exclude: [] };
}

export function writeSpaFallback(out = OUT) {
    const fallback = `${out}/__spa-fallback.html`;
    if (!existsSync(fallback)) {
        throw new Error(
            `${fallback} does not exist — the build emitted no SPA fallback, so a page ` +
                "with no prerendered document would have no shell to render into",
        );
    }
    assertPages();
    const { locales } = JSON.parse(readFileSync("project.inlang/settings.json", "utf8"));
    const prefixes = dynamicPrefixes();
    const routes = routeRules(locales, prefixes);

    copyFileSync(fallback, `${out}/404.html`);
    writeFileSync(`${out}/_routes.json`, `${JSON.stringify(routes, null, 2)}\n`);
    return { locales, prefixes, rules: routes.include.length };
}

// Guarded so the module can be imported by its test without writing anything.
if (process.argv[1]?.endsWith("spa-fallback.mjs")) {
    const { locales, prefixes, rules } = writeSpaFallback();
    console.log(
        `SPA fallback written; ${rules} route rules over ${prefixes.join(", ")} in ${locales.length} languages.`,
    );
}
