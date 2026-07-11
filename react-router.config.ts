// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { readFileSync, readdirSync } from "node:fs";
import type { Config } from "@react-router/dev/config";
import { generateStaticLocalizedUrls } from "./app/paraglide/runtime.js";
import { songId } from "./core/songId";

// The static routes, in canonical (unprefixed) form. generateStaticLocalizedUrls
// expands each into one prefixed path per locale (/en/scores, /de/scores, …).
const BASE_PATHS = [
    "/",
    "/compose",
    "/daily",
    "/library",
    "/library/import",
    "/assignments",
    "/you",
    "/review",
    "/settings",
    "/help",
    "/board",
];

// Prerender a play page for every bundled score so each piece is indexable with its own
// title and structured data. The id is the content fingerprint, matching loadBundledScores
// in app/lib/catalog.ts. User-imported scores stay client-only.
const BUNDLED_PLAY_PATHS = readdirSync("scores")
    .filter((name) => name.endsWith(".musicxml"))
    .map((name) => `/play/${songId(readFileSync(`scores/${name}`, "utf8"))}`);

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
