// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Compiles app/paraglide/ for English alone, then runs the converter's build.
//
// All 26 locales come to 11.8 MB of the bundle — three quarters of it, and past the
// 12 MB the upload accepts. Pinning PLINKY_LOCALE only marks the other languages dead;
// the converter bundles unminified, so nothing removes them. Compiling one locale is what
// actually leaves them out. A design renders in one language, so this costs nothing.
//
// The tree is left English-only afterwards. Run `npm run messages` to restore it before
// working on anything else — every other locale is missing until you do.

import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const PROJECT = ".design-sync/project.inlang";

// Beyond the base locale: LegalTranslationNotice renders the "this page is machine
// translated" notice, so its story picks a language that is not English. A locale a story
// names has to be compiled or the story throws on an unknown locale.
const ALSO = ["de"];

// A copy rather than a written-from-scratch project: the cache holds the plugin the real
// project resolves from a CDN, so copying it keeps the compile offline, and every setting
// we do not deliberately change stays whatever the real project says.
rmSync(PROJECT, { recursive: true, force: true });
mkdirSync(".design-sync", { recursive: true });
cpSync("project.inlang", PROJECT, { recursive: true });

const settings = JSON.parse(readFileSync("project.inlang/settings.json", "utf8"));
writeFileSync(
    `${PROJECT}/settings.json`,
    `${JSON.stringify(
        {
            ...settings,
            locales: [settings.baseLocale, ...ALSO],
            // Message files are read relative to the directory holding the project.
            "plugin.inlang.messageFormat": { pathPattern: "../messages/{locale}.json" },
        },
        null,
        4,
    )}\n`,
);

execFileSync("node", ["dev/compile-messages.mjs"], {
    stdio: "inherit",
    env: { ...process.env, PLINKY_INLANG_PROJECT: PROJECT, PLINKY_LOCALE: settings.baseLocale },
});
console.log(`app/paraglide: ${settings.baseLocale} only — run \`npm run messages\` to restore`);
