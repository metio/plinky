// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { execFileSync } from "node:child_process";
import { readdirSync, renameSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Regenerates the traces each Quint model's replay test runs against. Quint is not in
// the devShell — it is needed to WRITE traces, never to replay them, so it stays an
// on-demand npx download rather than a tool every CI job installs.
//
// Each model is checked against its own invariant first: a trace is only worth replaying
// if the model it came from holds together, and a violation here is a fault in the model
// or a real design error, either way to be read before any of it reaches the app.

const here = dirname(fileURLToPath(import.meta.url));
const QUINT = "@informalsystems/quint";
const MODELS = readdirSync(here)
    .filter((file) => file.endsWith(".qnt"))
    .map((file) => file.replace(/\.qnt$/, ""));

const quint = (args) =>
    execFileSync("npx", ["--yes", QUINT, ...args], { cwd: here, encoding: "utf8" });

for (const model of MODELS) {
    console.log(`${model}: typecheck`);
    quint(["typecheck", `${model}.qnt`]);

    const out = join(here, "traces", model);
    rmSync(out, { recursive: true, force: true });

    console.log(`${model}: exploring`);
    // The samples explore; the traces are what gets committed. Both are deliberately
    // modest: the point is a spread of interleavings a hand-written scenario would not
    // combine, not an exhaustive search, which is the model checker's job and not a
    // thing to run on every push.
    const log = quint([
        "run",
        `${model}.qnt`,
        `--main=${model}`,
        "--invariant=inv",
        "--max-steps=25",
        "--max-samples=200",
        "--n-traces=12",
        "--mbt",
        `--out-itf=${join("traces", model, "run.itf.json")}`,
    ]);
    console.log(log.trim().split("\n").slice(-2).join("\n"));

    // Quint numbers the files by appending the index, which sorts 10 before 2; the pad
    // keeps a failure's trace name meaning the same thing on every machine.
    for (const file of readdirSync(out)) {
        const index = Number(file.replace(/\D/g, ""));
        renameSync(join(out, file), join(out, `run_${String(index).padStart(2, "0")}.itf.json`));
    }
    console.log(`${model}: ${readdirSync(out).length} traces`);
}
