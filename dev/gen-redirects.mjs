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
import { dynamicPaths, staticPaths } from "./pages.mjs";

const OUT = "build/client";
const RETIRED = "dev/retired-routes.json";
const DEFAULT_LOCALE = "en";
// Cloudflare Pages reads the first hundred rules of the file and ignores the rest. It
// says nothing about the ones it dropped: the deploy succeeds, the file is there in full,
// and the addresses past the hundredth simply answer 404 again.
//
// This was measured against the live site rather than read off a page. Rule 97 redirected
// and rule 101 did not, with nothing but ordinary static rules between them — so the
// ceiling is a hundred rules of any kind, not the two-thousand-static-and-a-hundred-dynamic
// this file used to check. Those two numbers could not fail at this site's size, which is
// why a file of a hundred and twenty-four shipped with its last twenty-four rules inert
// and twelve pages answering 404 to any address that named them without a language.
export const REDIRECT_RULE_LIMIT = 100;

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
export function redirectRules(retired, pages, dynamic, defaultLocale = DEFAULT_LOCALE) {
    const rules = [];
    // A piece, a composer, a shelf or a glossary mark named with no language. The whole
    // route is used rather than its first segment: a shelf is /music/grade/3, and a rule
    // written against /music would carry one segment where three are needed and leave the
    // address a 404. Cloudflare's placeholders match a segment each, so the shape of the
    // route is the shape of the rule.
    for (const route of dynamic) {
        const shape = route.replace(/:[A-Za-z]+/, ":id");
        rules.push(`${shape} /${defaultLocale}${shape}/ 301`);
        rules.push(`${shape}/ /${defaultLocale}${shape}/ 301`);
    }
    // A page that still exists, named without a language. This is the shape a link takes
    // when it is copied out of somewhere that stripped the prefix, and it is written every
    // day; it goes before the historical rules because only the first hundred are read.
    for (const page of pages) {
        if (page === "/") {
            continue; // the bare root is the language chooser and answers on its own
        }
        for (const spelled of spellings(page)) {
            rules.push(`${spelled} /${defaultLocale}${page}/ 301`);
        }
    }
    // A page that has been renamed, in the language it was read in. A splat carries what
    // followed a retired trainer onto the play page.
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
    }
    // A retired page named without a language is not written here, and that is the cut the
    // hundred forces. Such an address needs a link written before the page was renamed AND
    // before the site had languages at all — two generations of staleness, against a live
    // page's language-less address, which anybody can produce today by deleting a prefix.
    // The splat rules above keep the retired trainers reachable in either shape, since a
    // player's own saved link to an exercise is the one case where the address carried
    // something worth keeping.
    return rules;
}

export function countRules(rules) {
    const dynamic = rules.filter((rule) => /[:*]/.test(rule.split(" ")[0])).length;
    return { dynamic, fixed: rules.length - dynamic, total: rules.length };
}

export function writeRedirects(out = OUT, retiredPath = RETIRED) {
    const rules = redirectRules(readRetired(retiredPath), staticPaths(), dynamicPaths());
    const { dynamic, fixed, total } = countRules(rules);
    if (total > REDIRECT_RULE_LIMIT) {
        throw new Error(
            `_redirects would hold ${total} rules and Cloudflare Pages reads the first ` +
                `${REDIRECT_RULE_LIMIT}. The rest are dropped silently, so every address ` +
                "past the hundredth answers 404 while the deploy reports success — decide " +
                "which rules to keep rather than letting the file decide by its order.",
        );
    }
    const header =
        "# SPDX-FileCopyrightText: The Plinky Authors\n# SPDX-License-Identifier: AGPL-3.0-or-later\n" +
        "# Written by dev/gen-redirects.mjs at deploy; edit dev/retired-routes.json instead.\n";
    writeFileSync(`${out}/_redirects`, `${header}${rules.join("\n")}\n`);
    return { dynamic, fixed, total };
}

// Guarded so the module can be imported by its test without writing anything.
if (process.argv[1]?.endsWith("gen-redirects.mjs")) {
    const { dynamic, fixed, total } = writeRedirects();
    console.log(
        `_redirects written: ${total} rules of the ${REDIRECT_RULE_LIMIT} Cloudflare reads ` +
            `(${fixed} static, ${dynamic} dynamic).`,
    );
}
