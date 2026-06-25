// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { Config } from "@react-router/dev/config";
import { generateStaticLocalizedUrls } from "./app/paraglide/runtime.js";

// The static routes, in canonical (unprefixed) form. generateStaticLocalizedUrls
// expands each into one prefixed path per locale (/en/scores, /de/scores, …).
const BASE_PATHS = [
    "/",
    "/sprint",
    "/daily",
    "/ear",
    "/scores",
    "/curriculums",
    "/tracks",
    "/progress",
    "/settings",
    "/import",
];

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
        return ["/", ...generateStaticLocalizedUrls(BASE_PATHS).map((url) => url.pathname)];
    },
} satisfies Config;
