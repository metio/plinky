// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

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
//     page, the daily, the review session, the placement drill) and the glossary, whose
//     examples draw immediately, land well past the light cap. A wrong guess fails loudly
//     here rather than silently, which is how each of them was found.
//
// Whether a page is noindex IS readable from the route that declares it, so the SEO
// assertion turns itself off for those pages without anyone maintaining a list.

import { readFileSync } from "node:fs";
import { assertPages, staticPaths } from "./dev/pages.mjs";

const pages = assertPages();

// The audit runs against the single-locale build, which is English.
const LOCALE = "en";
const url = (path) => `http://localhost/${LOCALE}${path === "/" ? "/" : `${path}/`}`;

// One concrete score page. Any bundled score would do; this one is prerendered.
const PLAY_SAMPLE = "/play/47xd2XDpYFCy";

// Pages whose own meta() marks them noindex. Lighthouse's is-crawlable audit tanks
// their SEO category by design, so that one assertion is dropped for them — while every
// other budget still applies.
const noindex = pages
    .filter((page) => !page.dynamic && page.module)
    .filter((page) => readFileSync(`app/${page.module}`, "utf8").includes("noindex"))
    .map((page) => page.path.slice(1))
    .filter(Boolean);

// Pages that bring the notation machinery with them as they load. Budgeted apart so its
// bulk cannot hide an app-code regression on the lighter pages, while the fifteen pages
// that carry no notation keep a tight cap that trips on a real one.
const notation = ["play", "daily", "review", "placement", "glossary"];

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
const SCRIPT_LIGHT = 235520;
const SCRIPT_NOTATION = 655360;

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
