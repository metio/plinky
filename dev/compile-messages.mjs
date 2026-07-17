// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// Compiles the Paraglide messages. Run via `npm run messages` (and as the
// prebuild step of build/dev/test/typecheck) since app/paraglide is gitignored.
//
// This replaces the paraglide CLI so we can pass urlPatterns, which the CLI
// cannot express: every locale — English included — carries a /<locale>/ path
// prefix, so each language prerenders to its own static page and the locale is
// always read from the URL (see react-router.config.ts and app/entry.server.tsx).

import { readFileSync, writeFileSync } from "node:fs";
import { compile } from "@inlang/paraglide-js";

const settings = JSON.parse(readFileSync("./project.inlang/settings.json", "utf8"));
const locales = settings.locales;

// The locale a per-locale build is pinned to (see the experimentalStaticLocale
// note below), validated up front so a typo fails the build instead of silently
// producing an all-locales bundle.
const staticLocale = process.env.PLINKY_LOCALE;
if (staticLocale && !locales.includes(staticLocale)) {
    throw new Error(
        `PLINKY_LOCALE="${staticLocale}" is not a known locale (${locales.join(", ")}).`,
    );
}

// One canonical pattern, with a prefixed localized form per locale. There is no
// unprefixed catch-all, so a bare path (e.g. "/") matches no locale and falls
// through to the strategies below — which is what drives the root redirect to
// the visitor's language.
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
    // Order is the whole behaviour. `url` first: a /de/ link renders German for
    // whoever opens it, so a shared link is honest regardless of the reader's own
    // choice. `localStorage` next, so a bare "/" reopens in the language the player
    // picked — setLocale writes it (it does not short-circuit on a pinned static
    // locale, so the write works from a per-locale build too), and only the
    // all-locales root build ever has to read it. `preferredLanguage` then serves a
    // first-time visitor, who has nothing stored yet.
    strategy: ["url", "localStorage", "preferredLanguage", "baseLocale"],
    urlPatterns,
    emitTsDeclarations: true,
    // Per-locale builds: `PLINKY_LOCALE=de npm run build` pins the compiled
    // static locale to a literal ("de"), so the runtime-branched `if (locale ===
    // "…")` arms for the other locales become dead code and tree-shake out —
    // that build ships only its own language. Unset (dev, test, the default
    // all-locales build) emits the plain `experimentalStaticLocale = undefined`,
    // so every locale is present and the runtime falls back to getLocale().
    // Read from the compiler (not a Vite define) because runtime.js is also
    // evaluated in raw Node — react-router.config.ts, dev scripts — where a
    // define would not apply and `assertIsLocale(undefined)` would throw.
    ...(staticLocale ? { experimentalStaticLocale: JSON.stringify(staticLocale) } : {}),
});

// Paraglide emits the static locale wrapped in `assertIsLocale("de")` — a
// throwing runtime call, so the bundler can't fold it to a constant and the
// dead per-locale branches survive (no tree-shaking, no size win). Unwrap it to
// the bare literal `"de"` so constant-folding eliminates the other languages.
// (Upstream would ideally emit the literal or mark the validator pure.)
if (staticLocale) {
    const runtimePath = "./app/paraglide/runtime.js";
    const literal = JSON.stringify(staticLocale);
    const source = readFileSync(runtimePath, "utf8");
    const unwrapped = source.replace(`assertIsLocale(${literal})`, literal);
    if (unwrapped === source) {
        throw new Error(
            `Could not unwrap assertIsLocale(${literal}) in runtime.js — the Paraglide ` +
                `output shape changed; per-locale tree-shaking would silently break.`,
        );
    }
    writeFileSync(runtimePath, unwrapped);
}
