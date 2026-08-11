// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { readFileSync, readdirSync } from "node:fs";
import type { Config } from "@react-router/dev/config";
import { generateStaticLocalizedUrls } from "./app/paraglide/runtime.js";
import { staticPaths } from "./dev/pages.mjs";
import { PEOPLE_INDEX } from "./core/peopleIndex";
import { personSlug } from "./core/person";
import { readScoreMetaFromText } from "./core/scoreMeta";
import { songId } from "./core/songId";

// Every page the route table defines, read from it rather than restated here: a route
// with no prerender entry has no static document and 404s, which nothing else catches.
// generateStaticLocalizedUrls expands each into one prefixed path per locale.
const BASE_PATHS = staticPaths();

// Every bundled score's id and composer, read once. The id is the content
// fingerprint, matching loadBundledScores in app/lib/catalog.ts; the composer
// (pure text pass, no parser) drives the person pages below.
const BUNDLED_SCORES = readdirSync("scores")
    .filter((name) => name.endsWith(".musicxml"))
    .map((name) => {
        const xml = readFileSync(`scores/${name}`, "utf8");
        return { id: songId(xml), composer: readScoreMetaFromText(xml).composer };
    });

// Prerender a play page for every bundled score so each piece is indexable with its own
// title and structured data. User-imported scores stay client-only.
const BUNDLED_PLAY_PATHS = BUNDLED_SCORES.map((score) => `/play/${score.id}`);

// Prerender a page for every composer the bundled catalogue credits, so each is a
// crawlable, sitemap-listed entity (name, their pieces, Person + BreadcrumbList
// structured data) rather than a JavaScript-only shell. One slug per composer,
// deduped; attribution markers ("Traditional") slug to "" and are skipped.
// Plus every composer the shipped catalogue credits with enough pieces to be worth a
// static document — read from the baked index (dev/bake-people.mts), which is derived
// from the same manifests the app loads. The floor keeps a page that would list one or
// two pieces off the sitemap: thin for a reader, thin for a crawler, and multiplied by
// every locale it is a build cost with nothing on the other side. A composer below the
// floor still has a working page; it simply renders on the client like any other.
const CATALOGUE_PERSON_SLUGS = Object.keys(PEOPLE_INDEX);

const PERSON_PATHS = [
    ...new Set([
        ...BUNDLED_SCORES.map((score) => personSlug(score.composer)).filter(Boolean),
        ...CATALOGUE_PERSON_SLUGS,
    ]),
].map((slug) => `/person/${slug}`);

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
        const paths = [...BASE_PATHS, ...BUNDLED_PLAY_PATHS, ...PERSON_PATHS];
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
