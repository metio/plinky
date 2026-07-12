// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// Fails loudly when the installed node_modules tree has drifted from
// package-lock.json — a rebase or pull that bumps a dependency leaves the old
// version on disk, and every local gate then runs older tools than CI's fresh
// `npm ci` (a laxer linter once passed code CI failed). npm records what it
// actually installed in node_modules/.package-lock.json; comparing the two
// version maps catches missing, extra, and mismatched packages alike.

import { existsSync, readFileSync } from "node:fs";

const fail = (lines) => {
    console.error(`check-node-modules: node_modules is out of sync with package-lock.json`);
    for (const line of lines) {
        console.error(`  - ${line}`);
    }
    console.error("Run `npm ci` and retry.");
    process.exit(1);
};

const INSTALLED = "node_modules/.package-lock.json";
if (!existsSync(INSTALLED)) {
    fail(["node_modules has no install record"]);
}

// Optional packages (platform-specific binaries like @biomejs/cli-darwin-*)
// are legitimately absent on other platforms, so they can't count as drift.
const versions = (raw) =>
    new Map(
        Object.entries(JSON.parse(raw).packages ?? {})
            .filter(([path, meta]) => path.startsWith("node_modules/") && !meta.optional)
            .map(([path, meta]) => [path, meta.version]),
    );

const wanted = versions(readFileSync("package-lock.json", "utf8"));
const installed = versions(readFileSync(INSTALLED, "utf8"));

const drift = [];
for (const [path, version] of wanted) {
    const have = installed.get(path);
    if (have === undefined) {
        drift.push(`${path.slice("node_modules/".length)} missing (want ${version})`);
    } else if (have !== version) {
        drift.push(`${path.slice("node_modules/".length)} is ${have}, lockfile wants ${version}`);
    }
}
for (const path of installed.keys()) {
    if (!wanted.has(path)) {
        drift.push(`${path.slice("node_modules/".length)} installed but not in the lockfile`);
    }
}

if (drift.length > 0) {
    // The first few name the problem; the count keeps a big drift readable.
    fail([...drift.slice(0, 10), ...(drift.length > 10 ? [`…and ${drift.length - 10} more`] : [])]);
}
console.log(`check-node-modules: installed tree matches package-lock.json (${wanted.size} packages).`);
