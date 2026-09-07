// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// `_redirects` for Cloudflare Pages: every address the site used to answer at, sent on
// to where that page lives now, with a real 301 the crawler can follow.
//
// Two kinds of old address. A retired page — /you became /stats, /library became /music,
// five exercise trainers folded into /play — still stands in a search index and in links
// people kept, in every language; the table in dev/retired-routes.json says where each
// one went. And an address with no language in it at all — /music, /play/<id> — which is
// how every link looked before the site was localised. The client router does send a
// visitor on from both, but only after the page has loaded, and a crawler reads the 404
// the static host answered with first: Search Console listed over six hundred of them.
//
// Written at deploy, beside the site, from the same page list the sitemap and the audits
// read, so a page renamed in app/routes.ts is one edit here and none anywhere else. Plain
// JavaScript on Node built-ins only, because the deploy runs it with nothing installed.
//
// Pages applies these before its static files and never on a route a Function handles
// (dev/spa-fallback.mjs writes that list: the localised /play/* and /person/*), so a rule
// here can only ever redirect an address that would otherwise be a 404.

import { readFileSync, writeFileSync } from "node:fs";
import { dynamicPrefixes, staticPaths } from "./pages.mjs";

const OUT = "build/client";
const RETIRED = "dev/retired-routes.json";
const DEFAULT_LOCALE = "en";
// Cloudflare's own ceilings: a rule with a placeholder or a splat is dynamic.
export const STATIC_RULE_LIMIT = 2000;
export const DYNAMIC_RULE_LIMIT = 100;

export function readRetired(path = RETIRED) {
    const { routes } = JSON.parse(readFileSync(path, "utf8"));
    return routes;
}

// Both spellings of a path, since Pages treats /music and /music/ as different addresses.
const spellings = (path) => (path === "/" ? ["/"] : [path, `${path}/`]);

// The rules, as lines of the file. Retired pages are matched with a `:locale` placeholder
// rather than one line per language, since a page that has gone has gone in all
// twenty-six; a splat carries an exercise id from a trainer onto the play page. An
// unlocalised address goes to English — the language the site is written in — because
// nothing here can read the visitor's own, and a 301 to a page whose hreflang names every
// other language loses nothing to a crawler.
export function redirectRules(retired, pages, prefixes, defaultLocale = DEFAULT_LOCALE) {
    const rules = [];
    // A piece or a composer named with no language: the id is one segment, so a
    // placeholder carries it, in both spellings.
    for (const prefix of prefixes) {
        rules.push(`${prefix}/:id /${defaultLocale}${prefix}/:id/ 301`);
        rules.push(`${prefix}/:id/ /${defaultLocale}${prefix}/:id/ 301`);
    }
    for (const { from, to } of retired) {
        if (from.endsWith("/*")) {
            const head = from.slice(0, -2);
            const target = to.endsWith("/*") ? `${to.slice(0, -2)}/:splat` : to;
            rules.push(`/:locale${head}/* /:locale${target} 301`);
            rules.push(`${head}/* /${defaultLocale}${target} 301`);
            continue;
        }
        for (const spelled of spellings(from)) {
            rules.push(`/:locale${spelled} /:locale${to}/ 301`);
        }
        for (const spelled of spellings(from)) {
            rules.push(`${spelled} /${defaultLocale}${to}/ 301`);
        }
    }
    for (const page of pages) {
        if (page === "/") {
            continue; // the bare root is the language chooser and answers on its own
        }
        for (const spelled of spellings(page)) {
            rules.push(`${spelled} /${defaultLocale}${page}/ 301`);
        }
    }
    return rules;
}

export function countRules(rules) {
    const dynamic = rules.filter((rule) => /[:*]/.test(rule.split(" ")[0])).length;
    return { dynamic, fixed: rules.length - dynamic };
}

export function writeRedirects(out = OUT, retiredPath = RETIRED) {
    const rules = redirectRules(readRetired(retiredPath), staticPaths(), dynamicPrefixes());
    const { dynamic, fixed } = countRules(rules);
    if (dynamic > DYNAMIC_RULE_LIMIT || fixed > STATIC_RULE_LIMIT) {
        throw new Error(
            `_redirects would need ${dynamic} dynamic and ${fixed} static rules; Cloudflare ` +
                `allows ${DYNAMIC_RULE_LIMIT} and ${STATIC_RULE_LIMIT}`,
        );
    }
    const header =
        "# SPDX-FileCopyrightText: The Plinky Authors\n# SPDX-License-Identifier: AGPL-3.0-or-later\n" +
        "# Written by dev/gen-redirects.mjs at deploy; edit dev/retired-routes.json instead.\n";
    writeFileSync(`${out}/_redirects`, `${header}${rules.join("\n")}\n`);
    return { dynamic, fixed };
}

// Guarded so the module can be imported by its test without writing anything.
if (process.argv[1]?.endsWith("gen-redirects.mjs")) {
    const { dynamic, fixed } = writeRedirects();
    console.log(`_redirects written: ${fixed} static and ${dynamic} dynamic rules.`);
}
