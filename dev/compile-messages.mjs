// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// Compiles the Paraglide messages. Run via `npm run messages` (and as the
// prebuild step of build/dev/test/typecheck) since app/paraglide is gitignored.
//
// This replaces the paraglide CLI so we can pass urlPatterns, which the CLI
// cannot express: every locale — English included — carries a /<locale>/ path
// prefix, so each language prerenders to its own static page and the locale is
// always read from the URL (see react-router.config.ts and app/entry.server.tsx).

import { readFileSync } from "node:fs";
import { compile } from "@inlang/paraglide-js";

const settings = JSON.parse(readFileSync("./project.inlang/settings.json", "utf8"));
const locales = settings.locales;

// One canonical pattern, with a prefixed localized form per locale. There is no
// unprefixed catch-all, so a bare path (e.g. "/") matches no locale and falls
// through to the preferredLanguage strategy — which is what drives the root
// redirect to the visitor's language.
const urlPatterns = [
    {
        pattern: ":protocol://:domain(.*)::port?/:path(.*)?",
        localized: locales.map((locale) => [
            locale,
            `:protocol://:domain(.*)::port?/${locale}/:path(.*)?`,
        ]),
    },
];

await compile({
    project: "./project.inlang",
    outdir: "./app/paraglide",
    strategy: ["url", "preferredLanguage", "baseLocale"],
    urlPatterns,
    emitTsDeclarations: true,
});
