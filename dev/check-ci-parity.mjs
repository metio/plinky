// SPDX-FileCopyrightText: The Klimpi Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Enforces that every CI gate has a matching command, so a local
// `ci-<name>` runs exactly what CI runs. Two rules:
//   1. Every gate job in verify.yml invokes its check through a `ci-*` command,
//      never a raw command inline — so the invocation lives in one place
//      (.breto.edn), not duplicated in YAML.
//   2. Every `ci-<name>` a job calls is defined in .breto.edn.
// Pure source analysis over .breto.edn + the workflow (no build, no dependencies),
// run via `npm run ci:parity` and its own CI job.

import { readFileSync } from "node:fs";
import { gatesInWorkflow, HEAVY } from "./ciGates.mjs";

const project = readFileSync(".breto.edn", "utf8");

// The `ci-*` commands .breto.edn defines.
const defined = new Set(
    [...project.matchAll(/^\s*\{?"(ci-[a-z0-9-]+)"\s+\{:run/gm)].map((match) => match[1]),
);

const problems = [];
const required = new Set();
const { wrappers, raw } = gatesInWorkflow();
for (const name of wrappers) {
    required.add(name);
}
for (const { job, command } of raw) {
    problems.push(
        `job "${job}" runs a raw command: \`${command}\` — move it into a ci-* command in .breto.edn and call that instead`,
    );
}

for (const name of HEAVY) {
    if (!defined.has(name)) {
        problems.push(
            `dev/ciGates.mjs lists \`${name}\` as heavy, but .breto.edn defines no command "${name}" — the local runner would not skip the gate it is meant to`,
        );
    }
}

for (const name of required) {
    if (!defined.has(name)) {
        problems.push(`job command \`${name}\` has no matching command in .breto.edn`);
    }
}

if (problems.length > 0) {
    console.error(`CI ↔ .breto.edn command parity failed:\n- ${problems.join("\n- ")}`);
    process.exit(1);
}

console.log(
    `CI ↔ .breto.edn parity OK: ${required.size} gate job(s) each run a ci-* command defined in .breto.edn.`,
);
