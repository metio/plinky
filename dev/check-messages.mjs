// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// Guards that every locale carries every message. The base locale (English) is the
// contract: a key present there but missing from another locale falls back to
// English at runtime, so a visitor in that language silently reads English — the
// gap this catches. It also flags the reverse, an orphan key left in a locale after
// a rename or removal, which bloats the file and can hide a typo. And it guards the
// contract's own hygiene: an English key no source file references is dead copy
// that every future translation pass would still pay 26x for, so it fails too.
// Pure source analysis over messages/*.json and app/ sources (no build, no
// dependencies), run via `npm run messages:check` and its own CI job.

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const settings = JSON.parse(readFileSync("./project.inlang/settings.json", "utf8"));
const { baseLocale, locales } = settings;
const pattern = settings["plugin.inlang.messageFormat"].pathPattern;

// The message files carry a "$schema" pointer alongside the real keys; it is not a
// message, so it never counts as missing or orphaned.
const META_KEYS = new Set(["$schema"]);

function keysOf(locale) {
    const path = pattern.replace("{locale}", locale);
    const parsed = JSON.parse(readFileSync(path, "utf8"));
    return new Set(Object.keys(parsed).filter((key) => !META_KEYS.has(key)));
}

const baseKeys = keysOf(baseLocale);
const problems = [];

// Every `m.<key>` reference in the app's own sources (the generated paraglide
// output would count every key by definition, so it is skipped). Tests count as
// references: they read the same catalogue through the same accessor.
function referencedKeys() {
    const referenced = new Set();
    const accessor = /\bm\.([a-z0-9_]+)/g;
    const stack = ["app"];
    while (stack.length > 0) {
        const dir = stack.pop();
        for (const entry of readdirSync(dir, { withFileTypes: true })) {
            const path = join(dir, entry.name);
            if (entry.isDirectory()) {
                if (entry.name !== "paraglide") {
                    stack.push(path);
                }
            } else if (/\.(ts|tsx)$/.test(entry.name)) {
                const source = readFileSync(path, "utf8");
                for (const match of source.matchAll(accessor)) {
                    referenced.add(match[1]);
                }
            }
        }
    }
    return referenced;
}

const referenced = referencedKeys();
const unreferenced = [...baseKeys].filter((key) => !referenced.has(key));
if (unreferenced.length > 0) {
    console.error(
        `x ${baseLocale}: ${unreferenced.length} key(s) no source references — dead copy that ` +
            `every locale still carries: ${unreferenced.join(", ")}`,
    );
    console.error("Remove them from every messages/<locale>.json (or wire them up), then re-run.");
    process.exit(1);
}

for (const locale of locales) {
    if (locale === baseLocale) {
        continue;
    }
    const localeKeys = keysOf(locale);
    const missing = [...baseKeys].filter((key) => !localeKeys.has(key));
    const orphan = [...localeKeys].filter((key) => !baseKeys.has(key));
    if (missing.length > 0 || orphan.length > 0) {
        problems.push({ locale, missing, orphan });
    }
}

if (problems.length === 0) {
    console.log(
        `All ${locales.length} locales carry every one of the ${baseKeys.size} ${baseLocale} messages.`,
    );
    process.exit(0);
}

for (const { locale, missing, orphan } of problems) {
    if (missing.length > 0) {
        console.error(`✗ ${locale}: missing ${missing.length} — ${missing.join(", ")}`);
    }
    if (orphan.length > 0) {
        console.error(`✗ ${locale}: orphan ${orphan.length} (not in ${baseLocale}) — ${orphan.join(", ")}`);
    }
}
console.error(
    `\n${problems.length} locale(s) out of sync with ${baseLocale}. Translate the missing keys ` +
        `into each messages/<locale>.json (or remove orphaned ones), then re-run.`,
);
process.exit(1);
