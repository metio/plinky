// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// Verifies the built client JavaScript stays within budget, so the bundle can't
// grow unnoticed. Run after `npm run build` (the CI build job and `npm run size`).
//
// Budgets are gzipped sizes and a ratchet: lower them as you trim; raise them
// deliberately when a feature genuinely needs the bytes. OpenSheetMusicDisplay is
// a large, pinned vendor dependency that is lazy-loaded only on score pages, so it
// is budgeted apart from our own code — that keeps an app-code regression visible
// instead of lost behind OSMD's bulk.

import { readdirSync, readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";

const DIR = "build/client/assets";
const VENDOR = /opensheetmusicdisplay/;

const BUDGET_TOTAL_KB = 580;
// Bumped to 268 for the always-loaded header streak badge; still a tight ratchet.
const BUDGET_APP_KB = 268;

const chunks = readdirSync(DIR)
    .filter((name) => name.endsWith(".js"))
    .map((name) => ({ name, gz: gzipSync(readFileSync(`${DIR}/${name}`)).length }))
    .sort((a, b) => b.gz - a.gz);

const total = chunks.reduce((sum, chunk) => sum + chunk.gz, 0);
const vendor = chunks
    .filter((chunk) => VENDOR.test(chunk.name))
    .reduce((sum, chunk) => sum + chunk.gz, 0);
const app = total - vendor;
const kb = (bytes) => (bytes / 1024).toFixed(1);

console.log("Largest client chunks (gzipped):");
for (const chunk of chunks.slice(0, 8)) {
    console.log(`  ${kb(chunk.gz).padStart(7)} KB  ${chunk.name}`);
}
console.log(
    `Total ${kb(total)} KB · vendor/OSMD ${kb(vendor)} KB · app ${kb(app)} KB ` +
        `(budgets: total ${BUDGET_TOTAL_KB}, app ${BUDGET_APP_KB})`,
);

const problems = [];
if (total / 1024 > BUDGET_TOTAL_KB) {
    problems.push(`total ${kb(total)} KB exceeds the ${BUDGET_TOTAL_KB} KB budget`);
}
if (app / 1024 > BUDGET_APP_KB) {
    problems.push(`app ${kb(app)} KB exceeds the ${BUDGET_APP_KB} KB budget`);
}
if (problems.length > 0) {
    console.error(
        `\nBundle over budget:\n- ${problems.join("\n- ")}\n` +
            "Trim the bundle, or raise the budget in dev/check-bundle-size.mjs deliberately.",
    );
    process.exit(1);
}
console.log("Bundle within budget.");
