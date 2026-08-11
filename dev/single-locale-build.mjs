// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Whether build/client holds the build the per-visitor gates are allowed to measure.
//
// Two different builds land in the same directory. `npm run build` prerenders all 26
// languages there — a local preview convenience that ships nowhere — while the deploy,
// the size budget, the a11y sweep and Lighthouse all care about ONE tree-shaken locale,
// because that is what a single visitor downloads. Measuring the all-locales tree
// reports roughly three times the real weight.
//
// The size budget has always caught this. Lighthouse did not: it read whatever was in
// the directory and failed its script-payload assertion on seven pages at once, which
// looks exactly like a real regression and sends you looking for one. So the check
// lives here, and every gate that reads a built site calls it.
//
// The lasting fix is upstream of the check: the gates now build what they measure
// (ci-build and ci-lighthouse both run `npm run build:single`, and a11y builds it too),
// so nothing in the repo produces an all-locales tree unless it is asked to by name.
// This guard is what catches the one remaining path — a hand-run `npm run build`
// followed by a gate — and says which command to run instead.

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";

const CLIENT = "build/client";

// The locales that get their own prerendered directory, read from the i18n settings so
// this never drifts from the real list.
function knownLocales() {
    return new Set(JSON.parse(readFileSync("./project.inlang/settings.json", "utf8")).locales);
}

export function builtLocales() {
    if (!existsSync(CLIENT)) {
        return [];
    }
    const known = knownLocales();
    return readdirSync(CLIENT).filter(
        (name) => known.has(name) && statSync(`${CLIENT}/${name}`).isDirectory(),
    );
}

// Exits the process with an explanation when the wrong build is on disk. `gate` names
// the caller so the message says which command to re-run.
export function requireSingleLocaleBuild(gate) {
    const locales = builtLocales();
    if (locales.length <= 1) {
        return;
    }
    console.error(
        `build/client holds ${locales.length} prerendered locales — this is an all-locales ` +
            `\`npm run build\`, which ${gate} can't measure (a visitor downloads one language, ` +
            "not all of them).\n" +
            "Build the single locale CI and the deploy use, then re-run:\n" +
            "  nix develop --command npm run build:single\n",
    );
    process.exit(1);
}

// Usable as a step of its own, so a shell wrapper can assert before it runs a tool that
// has no idea what it is looking at.
if (process.argv[1]?.endsWith("single-locale-build.mjs")) {
    requireSingleLocaleBuild(process.argv[2] ?? "this gate");
}
