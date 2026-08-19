// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Runs the layer rules, and refuses to pass while it cannot see the code they are about.
//
// dependency-cruiser needs a TypeScript compiler it supports in order to read .ts and
// .tsx at all. Without one it does not fail — it enumerates nothing, finds no violations
// in the nothing it enumerated, prints a warning among the noise of a build log, and
// exits 0. That is the worst way for a gate to break: `npm run arch` stayed green for
// weeks with `ui-is-pure`, `stores-point-down` and every other rule evaluated over an
// empty set, while CLAUDE.md and ARCHITECTURE.md both named it as the thing enforcing
// them.
//
// So the check is not only "were there violations" but "did it look at the code". The
// floor is measured against what is actually on disk rather than written down as a
// number, so it neither rots as the tree grows nor needs anybody to remember it.
//
// "At least one module" is not enough, which is worth recording because it looks like it
// should be: the scripts under dev/ import from app/ and core/, so a blind cruise still
// drags a handful of their modules in behind those imports and a zero-floor check passes
// while seeing almost nothing.

import { spawnSync } from "node:child_process";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const TREES = ["core", "app", "dev", "react-router.config.ts"];
// The trees the layer rules are actually about. dev/ is scanned too, but it is the one
// depcruise can read without a TypeScript compiler — so it proves nothing about health.
const MUST_SEE = ["app/", "core/"];
// How much of a tree must be reached before the run counts as having looked at it. Well
// under 1 because generated files, type-only declarations and modules nothing imports are
// legitimately absent; well over the ~2-20% a blind cruise drags in behind dev/.
const FLOOR = 0.6;

// The source files a cruise of a tree ought to reach. Tests and stories are excluded the
// way the rules exclude them.
function sourceCount(tree) {
    let total = 0;
    const walk = (dir) => {
        for (const entry of readdirSync(dir)) {
            const path = join(dir, entry);
            if (statSync(path).isDirectory()) {
                if (entry !== "paraglide" && !entry.startsWith("__")) {
                    walk(path);
                }
                continue;
            }
            if (/\.(ts|tsx)$/.test(entry) && !/\.(test|stories|property\.test)\./.test(entry)) {
                total += 1;
            }
        }
    };
    walk(tree.replace(/\/$/, ""));
    return total;
}

const run = spawnSync("npx", ["depcruise", ...TREES, "--output-type", "json"], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
});

if (run.error) {
    console.error(`Could not run dependency-cruiser: ${run.error.message}`);
    process.exit(1);
}

let report;
try {
    report = JSON.parse(run.stdout);
} catch {
    console.error("dependency-cruiser did not return a report:");
    console.error(run.stdout.slice(0, 2000) || run.stderr.slice(0, 2000));
    process.exit(1);
}

const modules = report.modules ?? [];
const seen = Object.fromEntries(
    MUST_SEE.map((tree) => [tree, modules.filter((one) => one.source.startsWith(tree)).length]),
);
const onDisk = Object.fromEntries(MUST_SEE.map((tree) => [tree, sourceCount(tree)]));
const reached = (tree) => (onDisk[tree] === 0 ? 1 : seen[tree] / onDisk[tree]);
const blind = MUST_SEE.filter((tree) => reached(tree) < FLOOR);

if (blind.length > 0) {
    console.error(
        `\ndependency-cruiser barely reached ${blind.join(" or ")}.\n\n` +
            "The layer rules were evaluated over almost nothing, so this gate proved nothing.\n" +
            "It reads .ts/.tsx only through a TypeScript compiler it supports; check that the\n" +
            "installed typescript is within dependency-cruiser's peer range.\n\n" +
            `${MUST_SEE.map(
                (tree) =>
                    `  ${tree} ${seen[tree]} of ${onDisk[tree]} source files (${Math.round(reached(tree) * 100)}%)`,
            ).join("\n")}\n`,
    );
    if (run.stderr.trim()) {
        console.error(run.stderr.trim());
    }
    process.exit(1);
}

// Severity decides what blocks, exactly as it does for dependency-cruiser's own CLI: an
// `error` rule is the contract, a `warn` is a smell somebody chose to record rather than
// enforce. Failing on both would have made this gate reject a `no-orphans` warning that
// has been deliberately non-blocking since the rule was written.
const violations = report.summary?.violations ?? [];
const errors = violations.filter((one) => one.rule.severity === "error");
const say = (one) => `${one.rule.severity}: ${one.rule.name} — ${one.from} → ${one.to}`;

for (const violation of violations.filter((one) => one.rule.severity !== "error")) {
    console.warn(say(violation));
}
if (errors.length > 0) {
    for (const violation of errors) {
        console.error(say(violation));
    }
    console.error(`\n${errors.length} dependency violation(s).`);
    process.exit(1);
}

console.log(
    `Architecture OK: ${modules.length} modules cruised (${MUST_SEE.map((tree) => `${tree} ${seen[tree]}`).join(", ")}), no errors.`,
);
