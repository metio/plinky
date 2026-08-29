// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Runs every gate CI runs, read out of the workflow rather than remembered.
//
// The problem this solves: choosing which gates to run before a push, by hand, from what
// a change looks related to. That is how a push goes red on the gate nobody thought of —
// a curation edit tripping the composer index, a script switched to a runner one job does
// not install, a reduction pushing a Lighthouse budget four hundred pages away. None of
// those are related to their change by inspection; they are related by the workflow, and
// the workflow already says so.
//
// Heavy gates are skipped by default and NAMED when they are, because a runner that
// quietly leaves eight out prints a green summary of a partial truth. --all includes them,
// and expects the machine to be free: on this host they belong under `capped`.
//
// Usage: npm run ci:local [-- --all]

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { gatesInWorkflow, HEAVY } from "./ciGates.mjs";

const all = process.argv.includes("--all");
const { wrappers } = gatesInWorkflow();
const chosen = wrappers.filter((name) => all || !HEAVY.has(name));
const skipped = wrappers.filter((name) => !chosen.includes(name));

console.log(`${chosen.length} of ${wrappers.length} gates, in workflow order:\n`);

const failed = [];
for (const [index, name] of chosen.entries()) {
    process.stdout.write(`  [${index + 1}/${chosen.length}] ${name.padEnd(22)}`);
    const started = Date.now();
    // Run the wrapper the way CI does. Already inside the devShell when invoked through
    // npm, so the wrapper is on PATH.
    const run = spawnSync(name, { stdio: ["ignore", "pipe", "pipe"], encoding: "utf8" });
    const seconds = ((Date.now() - started) / 1000).toFixed(0);
    if (run.status === 0) {
        console.log(`ok    ${seconds}s`);
        continue;
    }
    console.log(`FAILED ${seconds}s`);
    failed.push({ name, output: `${run.stdout ?? ""}${run.stderr ?? ""}`.trimEnd() });
}

if (skipped.length > 0) {
    console.log(
        `\nNot run (heavy — pass --all, under \`capped\` on this host):\n  ${skipped.join("\n  ")}`,
    );
}

// The Frontend job delegates to metio/ci's reusable workflow, so the gates it brings —
// the build, the size budget, coverage, the story screenshots, both accessibility sweeps,
// Lighthouse, the browser fleet, and the shared lint gate — are named NOWHERE in this
// repo's workflow and therefore nowhere in the list above. Saying "all green" without
// saying that would be the same false completeness this script exists to end.
if (
    /uses:\s*metio\/ci\/\.github\/workflows\/frontend\.yml/.test(
        readFileSync(".github/workflows/verify.yml", "utf8"),
    )
) {
    console.log(
        "\nNot covered at all: the Frontend job delegates to metio/ci, whose gates this\n" +
            "workflow never names — build, size, coverage, story screenshots, a11y light and\n" +
            "dark, Lighthouse, the browser projects, and the shared lint gate (ci-typos,\n" +
            "ci-reuse, ci-yaml, ci-actionlint, ci-markdown). Run those yourself before a push\n" +
            "that touches what they measure.",
    );
}

if (failed.length > 0) {
    for (const { name, output } of failed) {
        console.log(`\n${"─".repeat(70)}\n${name}\n${"─".repeat(70)}\n${output.slice(-2000)}`);
    }
    console.log(`\n${failed.length} gate(s) failed: ${failed.map((f) => f.name).join(", ")}`);
    process.exit(1);
}
console.log(`\nAll ${chosen.length} ran green.`);
