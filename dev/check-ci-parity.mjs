// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// Enforces that every CI gate has a matching nix command, so a local
// `nix develop --command ci-<name>` runs exactly what CI runs. Two rules:
//   1. Every gate job in verify.yml invokes its check through a `ci-*` wrapper
//      (`nix develop --command ci-<name>`), never a raw command inline — so the
//      invocation lives in one place (flake.nix), not duplicated in YAML.
//   2. Every `ci-<name>` a job calls is defined as a writeShellScriptBin wrapper
//      in flake.nix.
// Pure source analysis over flake.nix + the workflow (no build, no dependencies),
// run via `npm run ci:parity` and its own CI job.

import { readFileSync } from "node:fs";

const flake = readFileSync("flake.nix", "utf8");
const workflow = readFileSync(".github/workflows/verify.yml", "utf8");

// The `ci-*` wrappers the flake defines.
const defined = new Set(
    [...flake.matchAll(/writeShellScriptBin\s+"(ci-[a-z0-9-]+)"/g)].map((match) => match[1]),
);

// Environment setup a job may run through nix that is not a gate, so it is exempt
// from needing a wrapper (installing dependencies, not checking anything).
const SETUP_COMMANDS = new Set(["npm ci"]);

const problems = [];
const required = new Set();
let job = null;

for (const line of workflow.split("\n")) {
    // Jobs are the 2-space-indented keys under `jobs:`.
    const jobHeader = line.match(/^ {2}([A-Za-z0-9_-]+):\s*$/);
    if (jobHeader) {
        job = jobHeader[1];
        continue;
    }
    // Skip YAML comments: a `#` line may quote `nix develop --command …` as prose
    // without being a gate step.
    if (line.trim().startsWith("#")) {
        continue;
    }
    const invocation = line.match(/nix develop --command\s+(.+?)\s*$/);
    if (!invocation) {
        continue;
    }
    const command = invocation[1].trim();
    if (SETUP_COMMANDS.has(command)) {
        continue;
    }
    const wrapper = command.match(/^(ci-[a-z0-9-]+)\b/);
    if (wrapper) {
        required.add(wrapper[1]);
    } else {
        problems.push(
            `job "${job}" runs a raw command through nix: \`${command}\` — move it into a ci-* wrapper in flake.nix and call that instead`,
        );
    }
}

for (const name of required) {
    if (!defined.has(name)) {
        problems.push(
            `job command \`${name}\` has no matching writeShellScriptBin "${name}" in flake.nix`,
        );
    }
}

if (problems.length > 0) {
    console.error(`CI ↔ nix command parity failed:\n- ${problems.join("\n- ")}`);
    process.exit(1);
}

console.log(
    `CI ↔ nix parity OK: ${required.size} gate job(s) each run a ci-* wrapper defined in flake.nix.`,
);
