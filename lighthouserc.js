// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The audited pages and their budgets, derived from the route table.
//
// This was a hand-kept array of URLs, and being absent from it was invisible: an
// unlisted page was never audited and both gates still passed, so a green a11y run said
// nothing about it. The list now comes from dev/pages.mjs, which reads app/routes.ts —
// add a route and it is audited, in both themes, from that moment. The a11y sweep reads
// this same file (dev/a11y.mjs), so the two audits cannot drift apart.
//
// Two things are still spelled out, for reasons rather than by omission:
//
//   * The score page is dynamic (/play/:scoreId), so auditing one means naming a real
//     score. One is enough — every play page is the same surface over different notes.
//
//   * Which pages pull the notation machinery in as they load. The source cannot be read
//     for this — a route that merely imports a score viewer may never mount one — so it
//     is an observed property, measured. Every page that opens onto a piece (the score
//     page, the daily, the review session, the placement drill), the glossary, whose
//     examples draw immediately, and the theory course, whose reading lessons print the
//     bar they are about, land well past the light cap. A wrong guess fails loudly here
//     rather than silently, which is how each of them was found — theory included, on the
//     run after its lessons started engraving.
//
// Whether a page is noindex IS readable from the route that declares it, so the SEO
// assertion turns itself off for those pages without anyone maintaining a list.

import { assertPages, noindexPaths, staticPaths } from "./dev/pages.mjs";
import { heaviestLocale } from "./dev/locale-stress.mjs";
import { builtLocales } from "./dev/single-locale-build.mjs";

// Fails loudly if the route-table reading has gone stale, before any of it is trusted.
assertPages();

// The audit runs against whatever single locale is on disk. The build picks the heaviest
// of the twenty-six, because a budget is a claim about what a visitor downloads and a
// Greek visitor downloads twice the message bytes an English one does — English being the
// one language none of these gates needed to check, since every string was written to fit
// it. Falling back to that same choice keeps this config readable before a build exists.
const LOCALE = builtLocales()[0] ?? heaviestLocale().locale;
const url = (path) => `http://localhost/${LOCALE}${path === "/" ? "/" : `${path}/`}`;

// One concrete score page. Any bundled score would do; this one is prerendered.
const PLAY_SAMPLE = "/play/47xd2XDpYFCy";

// Pages whose own meta() marks them noindex, as bare path segments for the URL patterns
// below. Lighthouse's is-crawlable audit tanks their SEO category by design, so that one
// assertion is dropped for them — while every other budget still applies. The same reading
// keeps them out of the sitemap (dev/gen-sitemap.mjs), so the two cannot disagree about
// which pages belong in the index.
const noindex = noindexPaths()
    .map((path) => path.slice(1))
    .filter(Boolean);

// Pages that bring the notation machinery with them as they load. Budgeted apart so its
// bulk cannot hide an app-code regression on the lighter pages, while the fifteen pages
// that carry no notation keep a tight cap that trips on a real one.
const notation = ["play", "daily", "review", "placement", "glossary", "theory"];

const group = (names) => `.*/(${names.join("|")})/.*`;
const outside = (names) => `^(?!.*/(${names.join("|")})/).*$`;

// Script weight and indexability are independent: the review session and the placement
// drill are both noindex AND arrive with notation. lhci applies every group whose pattern
// matches, so overlapping groups would hand those pages two script caps and the tighter
// one would fail them. The groups are therefore the cross product of the two properties,
// and mutually exclusive by construction.
const both = notation.filter((name) => noindex.includes(name));
const notationOnly = notation.filter((name) => !noindex.includes(name));
const noindexOnly = noindex.filter((name) => !notation.includes(name));
const named = [...new Set([...notation, ...noindex])];

// Lighthouse measures the single-locale build (per-visitor weight), as transfer size. The
// light cap is a tight ratchet on the shared/app code a plain page ships; the notation cap
// carries the score-rendering machinery as well.
//
// Transfer size counts THIRD-PARTY script too, so the analytics beacon rides in this
// number even though it is not ours and is not bundled — and its size is Cloudflare's to
// change, not ours. That is what the headroom above the app's own weight is for. It also
// means this budget can pass locally and fail on CI: a run that never fetches the beacon
// measures a page the CI runner does not.
// 234 KiB → 252 KiB: six theory lessons, two more tools, six more glossary marks and the
// shelf's filters all live in code every page loads, and the library — the heaviest page
// under this cap — measured 252,969 with them. Raised deliberately, the way the app
// bundle's own ratchet is; it still trips on a regression, from a higher floor.
// 252 KiB → 256 KiB: not a regression, the same code weighed in the language it is
// heaviest in. This audit built English until now — the shortest of the twenty-six, and
// the one language none of these gates needed to check — so a Greek visitor's download
// had never been measured at all. Settings, the heaviest page under this cap, came to
// 258,792 against a limit of 258,048: over by 744 bytes, which is the message text and
// nothing else. The floor keeps the same headroom above the real figure it had before.
// 640 KiB → 648 KiB on the notation pages: thinning a piece is a reading aid, so the
// transform ships and the play page carries it along with the preference and the control.
// The play page measured 656,106 against a limit of 655,360 — over by 746 bytes, which is
// the reduction and nothing else. Raised deliberately, like the app bundle's own ratchet;
// what does NOT ship is the measurement of what a reduction grades at, which happens once
// at bake time and is read out of the manifest.
const SCRIPT_LIGHT = 262144;
const SCRIPT_NOTATION = 663552;

const common = {
    "categories:best-practices": ["error", { minScore: 0.9 }],
    // Warn-only: the audits that can fail the build (script payload, layout shift,
    // crawlability) are deterministic on a prerendered page, while the performance score
    // moves with whatever else the runner is doing.
    "categories:performance": ["warn", { minScore: 0.9 }],
    "cumulative-layout-shift": ["error", { maxNumericValue: 0.1 }],
    "service-worker": "off",
    "uses-responsive-images": "off",
    "redirects-http": "off",
    "is-on-https": "off",
    "uses-http2": "off",
    canonical: "off",
};

// The accessibility category is left out of the collect settings because axe gates a11y
// in both light and dark, where Lighthouse only ever sees light.
//
// Exported twice on purpose. lhci reaches this file through require(), which hands an ES
// module back as a namespace object — so the config it looks for, `ci`, has to be a named
// export or it finds nothing and falls back to guessing where the build is. The default
// export is the shape every other reader expects.
export const ci = {
        collect: {
            staticDistDir: "./build/client",
            url: [...staticPaths().map(url), url(PLAY_SAMPLE)],
            numberOfRuns: 1,
            settings: {
                preset: "desktop",
                onlyCategories: ["performance", "best-practices", "seo"],
                disableFullPageScreenshot: true,
                skipAudits: ["screenshot-thumbnails", "final-screenshot"],
            },
        },
        assert: {
            assertMatrix: [
                { names: both, seo: "off", script: SCRIPT_NOTATION },
                { names: notationOnly, seo: "indexed", script: SCRIPT_NOTATION },
                { names: noindexOnly, seo: "off", script: SCRIPT_LIGHT },
            ]
                // A property no page has yet would otherwise emit `.*/()/.*`, which
                // matches everything.
                .filter((bucket) => bucket.names.length > 0)
                .map((bucket) => ({
                    matchingUrlPattern: group(bucket.names),
                    assertions: {
                        ...common,
                        "categories:seo":
                            bucket.seo === "off" ? "off" : ["error", { minScore: 0.9 }],
                        "resource-summary:script:size": [
                            "error",
                            { maxNumericValue: bucket.script },
                        ],
                    },
                }))
                // Everything else: indexable, and arriving without notation.
                .concat([
                    {
                        matchingUrlPattern: outside(named),
                        assertions: {
                            ...common,
                            "categories:seo": ["error", { minScore: 0.9 }],
                            "resource-summary:script:size": [
                                "error",
                                { maxNumericValue: SCRIPT_LIGHT },
                            ],
                        },
                    },
                ]),
        },
    upload: { target: "temporary-public-storage" },
};

export default { ci };
