// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { readFileSync, readdirSync } from "node:fs";
import type { Config } from "@react-router/dev/config";
import { generateStaticLocalizedUrls } from "./app/paraglide/runtime.js";
import { staticPaths } from "./dev/pages.mjs";
import { songId } from "./core/songId";

// Every page the route table defines, read from it rather than restated here: a route
// with no prerender entry has no static document and 404s, which nothing else catches.
// generateStaticLocalizedUrls expands each into one prefixed path per locale.
const BASE_PATHS = staticPaths();

// Every bundled score's id, read once: the content fingerprint, matching
// loadBundledScores in app/lib/catalog.ts.
const BUNDLED_SCORES = readdirSync("scores")
    .filter((name) => name.endsWith(".musicxml"))
    .map((name) => ({ id: songId(readFileSync(`scores/${name}`, "utf8")) }));

// Prerender a play page for every bundled score so each piece is indexable with its own
// title and structured data. User-imported scores stay client-only.
const BUNDLED_PLAY_PATHS = BUNDLED_SCORES.map((score) => `/play/${score.id}`);

// Composer pages are not prerendered, and deliberately so. There are four hundred of
// them, which in twenty-six languages is ten thousand documents — most of a Cloudflare
// Pages deployment's twenty-thousand-file allowance, spent on pages whose whole content
// arrives from two fetched files anyway. The edge writes each one instead
// (functions/_middleware.js), from the same data and in more detail than a prerender
// could: the composer's name, their pieces, and who they were, in the page's own
// language. They are in the sitemap all the same — dev/gen-sitemap.mjs reads them from
// the catalogue the edge reads, not from the tree.

export default {
    // SPA mode: no server, hydrated on the client.
    ssr: false,
    // Prerender each static route once per locale to its own HTML, so every
    // language carries its own title, lang, social-card metadata, and hreflang
    // for crawlers and link unfurlers that do not run JavaScript. Dynamic
    // per-exercise routes fall back to the SPA shell. The bare "/" prerenders as
    // a client redirect to the visitor's locale. Prerendering runs serially
    // (concurrency 1), which entry.server relies on to pin getLocale per page.
    prerender() {
        const paths = [...BASE_PATHS, ...BUNDLED_PLAY_PATHS];
        const localized = generateStaticLocalizedUrls(paths).map((url) => url.pathname);
        // A per-locale build (PLINKY_LOCALE=de) pins getLocale to its language, so
        // it can only render its own pages correctly — prerender just those. The
        // bare "/" redirect detects the visitor's language at runtime and must NOT
        // be pinned, so it comes from the default (all-locales) build alone, which
        // also supplies the SPA fallback for non-prerendered dynamic routes.
        const pinned = process.env.PLINKY_LOCALE;
        if (pinned) {
            return localized.filter((path) => path.startsWith(`/${pinned}/`));
        }
        // The default (all-locales) build in the per-locale pipeline only needs to
        // supply "/" and the SPA fallback; the localized pages come from the pinned
        // builds. A plain `npm run build` (local dev/preview) prerenders everything.
        if (process.env.PLINKY_ROOT_ONLY) {
            return ["/"];
        }
        return ["/", ...localized];
    },
} satisfies Config;
