// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// Builds the site once per locale, each bundle tree-shaken down to its own
// language (see dev/compile-messages.mjs + react-router.config.ts), and merges
// them into one build/client so a visitor to /de/… downloads only German.
//
// Layout of the merge:
//   - A default all-locales build (PLINKY_ROOT_ONLY) supplies "/", the SPA
//     fallback, and the root-redirect chunks — the only place the app must be
//     able to detect the visitor's language at runtime, so it can't be pinned.
//   - Each pinned build (PLINKY_LOCALE=xx) supplies build/client/<xx>/ pages and
//     its own hashed chunks. Content-hashed filenames make the merge safe:
//     locale-independent chunks (OSMD, pure logic) are byte-identical across
//     builds and collapse to one copy; message-bearing chunks differ per locale
//     and coexist, each referenced only by its locale's HTML.
//
// A plain `npm run build` stays the fast single all-locales build for local dev;
// this orchestration is for the deploy. Set PLINKY_LOCALES=en,de to build a
// subset (for testing the merge).

import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";

const settings = JSON.parse(readFileSync("./project.inlang/settings.json", "utf8"));
const locales = process.env.PLINKY_LOCALES
    ? process.env.PLINKY_LOCALES.split(",").map((l) => l.trim())
    : settings.locales;

const CLIENT = "build/client";
// The merge accumulator must live OUTSIDE build/, because `react-router build`
// wipes its build/ directory on every run — a merge dir under build/ would be
// deleted between locale builds, leaving only the last one.
const MERGED = ".build-merge";

// One build: recompile the messages for this locale mode, then build with the
// prerender-flake retry. The env selects the mode (pinned locale / root-only).
// build-retry resolves `react-router` from node_modules/.bin on PATH, which npm
// adds for its own scripts but not for a bare `node dev/build-retry.mjs`, so put
// it on PATH here.
function build(env, label) {
    console.log(`\n=== build-locales: ${label} ===`);
    const binPath = `${process.cwd()}/node_modules/.bin`;
    const childEnv = { ...process.env, ...env, PATH: `${binPath}:${process.env.PATH ?? ""}` };
    execFileSync("npm", ["run", "messages"], { stdio: "inherit", env: childEnv });
    execFileSync("node", ["dev/build-retry.mjs"], { stdio: "inherit", env: childEnv });
}

rmSync(MERGED, { recursive: true, force: true });
mkdirSync(MERGED, { recursive: true });

// 1. The all-locales base: "/" + SPA fallback + root-redirect chunks.
build({ PLINKY_ROOT_ONLY: "1", PLINKY_LOCALE: "" }, "root (all locales)");
cpSync(CLIENT, MERGED, { recursive: true });

// 2. Each language, pinned and tree-shaken; keep its pages + chunks.
for (const locale of locales) {
    build({ PLINKY_LOCALE: locale, PLINKY_ROOT_ONLY: "" }, `locale ${locale}`);
    if (!existsSync(`${CLIENT}/${locale}`)) {
        throw new Error(`build-locales: expected ${CLIENT}/${locale} from the ${locale} build.`);
    }
    cpSync(`${CLIENT}/${locale}`, `${MERGED}/${locale}`, { recursive: true });
    cpSync(`${CLIENT}/assets`, `${MERGED}/assets`, { recursive: true });
}

// 3. Swap the merged tree into build/client for the downstream sw/sitemap steps.
rmSync(CLIENT, { recursive: true, force: true });
cpSync(MERGED, CLIENT, { recursive: true });
rmSync(MERGED, { recursive: true, force: true });

console.log(`\nbuild-locales: merged ${locales.length} locale bundle(s) into ${CLIENT}.`);
