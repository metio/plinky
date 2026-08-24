// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Every page the app has, read from the route table that defines them.
//
// This used to be four hand-kept lists: the prerender paths, the Lighthouse URL set (the
// a11y sweep shares it), the Lighthouse bucket for pages that lazy-load the notation
// engine, and the size budget. Three of them failed silently when a new page was left
// out — a route with no prerender entry 404s as a static document, and a page missing
// from the audit set is simply never checked while both gates still pass. Adding
// /glossary proved it: only Lighthouse caught the 404, and only because the page had
// been added to that one array by hand.
//
// So the route table is the source and everything else derives. `app/routes.ts` is
// TypeScript, which the build can import but plain Node cannot, so it is read as text.
// That is a parse, and a parse can silently match nothing — hence assertPages() below,
// which every consumer runs: it fails loudly if the shape of the file has moved on.

import { existsSync, readFileSync } from "node:fs";

const ROUTES = "app/routes.ts";

// The locale layout holds every real page; the bare "/" outside it is a client-side
// redirector to the visitor's language and prerenders separately.
function localeBlock(source) {
    const start = source.indexOf('route(":locale"');
    if (start === -1) {
        throw new Error(`${ROUTES}: no route(":locale") block — the page list cannot be derived`);
    }
    return source.slice(start);
}

export function readPages() {
    const source = readFileSync(ROUTES, "utf8");
    const block = localeBlock(source);
    const pages = [];

    // `index("routes/home.tsx")` is the locale root; `route("help", "routes/help.tsx")`
    // is a named page. A path holding a ":" is a parameter — those are prerendered from
    // real data (a score id, a person slug) by react-router.config.ts, not from here.
    for (const match of block.matchAll(/\b(index|route)\(\s*"([^"]+)"(?:\s*,\s*"([^"]+)")?/g)) {
        const [, kind, first, second] = match;
        if (kind === "index") {
            pages.push({ path: "/", module: first });
            continue;
        }
        if (first === ":locale") {
            continue;
        }
        // The catch-all is not a page: it has no document to prerender, nothing to audit,
        // and listing it would put a literal "/*" in the sitemap.
        if (first === "*") {
            continue;
        }
        pages.push({
            path: `/${first}`,
            module: second ?? "",
            dynamic: first.includes(":"),
        });
    }
    return pages;
}

// The pages that prerender to their own document, in canonical (unprefixed) form.
export function staticPaths() {
    return readPages()
        .filter((page) => !page.dynamic)
        .map((page) => page.path);
}

// The exact call a route makes to opt out of the index. Matching the call rather than the
// bare word keeps a comment or a test name from reading as a declaration.
const NOINDEX_CALL = "noindexMeta()";

// The pages whose own meta() marks them noindex, read from the route module that declares
// it — in the same canonical (unprefixed) form as staticPaths().
//
// A page that forbids indexing must not be advertised for indexing, so the sitemap leaves
// these out; Lighthouse's is-crawlable audit would tank their SEO category by design, so
// that one assertion is dropped for them. Both readings come from here, so neither can
// drift from the route table or from each other. A restated copy of the list falls behind
// the moment a route adds the call, and what it produces is a sitemap submitting pages for
// indexing whose own documents refuse it — valid XML that no gate can see through, so the
// contradiction surfaces only as a Search Console error weeks later.
export function noindexPaths() {
    return readPages()
        .filter((page) => !page.dynamic && page.module)
        .filter((page) => readFileSync(`app/${page.module}`, "utf8").includes(NOINDEX_CALL))
        .map((page) => page.path);
}

// Fails when the parse has stopped describing the file — a reformatted route table, a
// renamed module, or a match that found nothing. Silence is the failure mode this
// module exists to remove, so every consumer calls this before trusting the result.
export function assertPages() {
    const source = readFileSync(ROUTES, "utf8");
    const pages = readPages();

    if (pages.length < 2) {
        throw new Error(
            `${ROUTES}: parsed ${pages.length} pages — the route table cannot be that small`,
        );
    }
    // Every call in the block must have produced an entry, so a shape the regex cannot
    // read is caught rather than skipped. Two calls are deliberately not pages: the
    // ":locale" wrapper and the "*" catch-all, neither of which has a document.
    const calls = (localeBlock(source).match(/\b(index|route)\(/g) ?? []).length - 2;
    if (calls !== pages.length) {
        throw new Error(
            `${ROUTES}: found ${calls} route calls but parsed ${pages.length} pages — ` +
                "the route table's shape has changed and dev/pages.mjs can no longer read it",
        );
    }
    // A parsed module that does not exist means the paths are being read off the wrong
    // argument, which would otherwise surface as a mystery 404 much later.
    for (const page of pages) {
        if (page.module && !existsSync(`app/${page.module}`)) {
            throw new Error(
                `${ROUTES}: parsed module app/${page.module} for ${page.path}, which does not exist`,
            );
        }
    }
    // noindexPaths() matches one exact call, so renaming or reformatting it would leave the
    // match finding nothing — and an empty noindex list reads as "every page is indexable",
    // which puts pages that forbid indexing back into the sitemap. Cross-check the precise
    // match against a loose one: a route module that mentions noindex at all without
    // matching the call means this reading has gone stale.
    const declared = new Set(noindexPaths());
    for (const page of pages) {
        if (!page.module || page.dynamic) {
            continue;
        }
        const mentions = readFileSync(`app/${page.module}`, "utf8").includes("noindex");
        if (mentions && !declared.has(page.path)) {
            throw new Error(
                `${ROUTES}: app/${page.module} mentions noindex but does not call ${NOINDEX_CALL} — ` +
                    "dev/pages.mjs can no longer tell which pages are noindex",
            );
        }
    }
    return pages;
}
