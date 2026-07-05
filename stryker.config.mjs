// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// Mutation testing measures test *quality*: Stryker rewrites core/ with small
// faults (flip a `<`, drop a `+`, return an empty array) and reruns the tests; a
// mutant that no test kills is a hole in the suite that line/branch coverage can't
// see. It runs over the pure domain layer only — see vitest.mutation.config.ts for
// why the browser/storybook projects are excluded.
/** @type {import('@stryker-mutator/core').PartialStrykerOptions} */
export default {
    testRunner: "vitest",
    vitest: { configFile: "vitest.mutation.config.ts" },
    // perTest lets Stryker run only the tests that cover each mutant, keeping the
    // sweep to minutes rather than hours.
    coverageAnalysis: "perTest",
    // Scoped to the property-tested pure modules — the highest-value logic (share
    // codec, difficulty/grade scoring, the play matcher, run history), where a
    // strong mutation score is the most meaningful quality signal. Widen this glob
    // toward the rest of core/ once the baseline lands; a whole-core sweep is
    // several thousand mutants and takes far longer than a first read warrants.
    mutate: [
        "core/shareCode.ts",
        "core/composition.ts",
        "core/scoreDifficulty.ts",
        "core/grade.ts",
        "core/matcher.ts",
        "core/history.ts",
    ],
    // Use most of the machine; each worker owns a vitest process.
    concurrency: 6,
    // Keep the sandbox tiny. Stryker otherwise copies every file it can see —
    // including the gitignored upstream score corpora, the built catalogue .mxl and
    // the PDMX dump (~1M files) — which dominates the run. These are never mutated
    // and no core test reads them, so exclude them outright.
    ignorePatterns: [
        "sources",
        "pdmx",
        "public/songs",
        "public/registry",
        "scores",
        "build",
        "coverage",
        ".react-router",
        ".lighthouseci",
        "storybook-static",
        "reports",
        ".stryker-tmp",
        ".build-merge",
    ],
    reporters: ["html", "clear-text", "progress"],
    htmlReporter: { fileName: "reports/mutation/index.html" },
    // The suite is fully deterministic, so a rerun over the same core/ files skips
    // unchanged mutants.
    incremental: true,
    incrementalFile: "reports/stryker-incremental.json",
    tempDirName: ".stryker-tmp",
    // Ratchet, like the coverage and bundle-size gates: `break` fails the run below
    // this score. Raise it as the suite improves; never lower it to pass a red run.
    thresholds: { high: 90, low: 74, break: 74 },
};
