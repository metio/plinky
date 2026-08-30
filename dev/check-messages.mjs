// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Guards that every locale carries every message. The base locale (English) is the
// contract: a key present there but missing from another locale falls back to
// English at runtime, so a visitor in that language silently reads English — the
// gap this catches. It also flags the reverse, an orphan key left in a locale after
// a rename or removal, which bloats the file and can hide a typo. And it guards the
// contract's own hygiene: an English key no source file references is dead copy
// that every future translation pass would still pay 26x for, so it fails too.
//
// And it compares the {placeholders} each translation interpolates against the
// contract's. Nothing else can: paraglide hands the arguments to the string and the
// string decides what to do with them, so a translation that drops {count} loses the
// number out of the sentence and one that invents {name} prints the braces at the
// reader — both silently, in a language the person writing the code cannot read.
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

// A message is either a plain string or the plugin's complex form — an array whose first
// element carries the plural variants. Both are messages; a filter that kept only strings
// let the complex ones out of every check below, which is how two of them sat outside the
// parity gate entirely while it reported all 26 locales complete.
function messagesOf(locale) {
    const path = pattern.replace("{locale}", locale);
    const parsed = JSON.parse(readFileSync(path, "utf8"));
    return Object.fromEntries(
        Object.entries(parsed).filter(
            ([key, value]) =>
                !META_KEYS.has(key) && (typeof value === "string" || isComplex(value)),
        ),
    );
}

const isComplex = (value) =>
    Array.isArray(value) && typeof value[0]?.match === "object" && value[0].match !== null;

// The text of every arm, for a check that only wants to read the words.
const armsOf = (value) => (isComplex(value) ? Object.values(value[0].match) : [value]);

// The {placeholders} a message interpolates. A translation carries the same set as the
// contract does, in any order and any number of times: a name the caller never passes
// renders as literal braces in front of the reader, and one the translation drops takes
// the number, the piece or the person's name out of the sentence entirely. The runtime
// cannot catch either — paraglide hands the arguments in and the string decides what to
// do with them — so it is caught here or not at all.
function placeholdersIn(text) {
    return new Set([...text.matchAll(/\{([a-zA-Z_][\w]*)\}/g)].map((match) => match[1]));
}

const baseMessages = messagesOf(baseLocale);
const baseKeys = new Set(Object.keys(baseMessages));
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
    const messages = messagesOf(locale);
    const localeKeys = new Set(Object.keys(messages));
    const missing = [...baseKeys].filter((key) => !localeKeys.has(key));
    const orphan = [...localeKeys].filter((key) => !baseKeys.has(key));

    const mismatched = [];
    for (const key of baseKeys) {
        const translated = messages[key];
        if (translated === undefined) {
            continue;
        }
        const wanted = placeholdersIn(armsOf(baseMessages[key] ?? "").join(" "));
        const found = placeholdersIn(armsOf(translated).join(" "));
        const dropped = [...wanted].filter((name) => !found.has(name));
        const invented = [...found].filter((name) => !wanted.has(name));
        if (dropped.length > 0 || invented.length > 0) {
            mismatched.push(
                `${key}: ${dropped.length > 0 ? `dropped {${dropped.join("} {")}}` : ""}` +
                    `${dropped.length > 0 && invented.length > 0 ? ", " : ""}` +
                    `${invented.length > 0 ? `invented {${invented.join("} {")}}` : ""}`,
            );
        }
    }

    // A plural message must answer for every category its OWN language can produce.
    // Paraglide compiles the variants into a chain of comparisons and, when none matches,
    // returns the message key — so a Polish count of five in a message carrying only `one`
    // and `other` does not read a little oddly, it prints "progress_backup_items" on the
    // page. The categories are not a matter of taste, so they are asked of Intl rather than
    // listed here, and they differ per language: Polish needs four, Croatian three, Japanese
    // one.
    const needed = new Intl.PluralRules(locale).resolvedOptions().pluralCategories;
    for (const [key, value] of Object.entries(messages)) {
        if (!isComplex(value)) {
            continue;
        }
        const arms = new Set(Object.keys(value[0].match).map((arm) => arm.split("=").at(-1)));
        const absent = needed.filter((category) => !arms.has(category));
        if (absent.length > 0) {
            mismatched.push(`${key}: no arm for ${absent.join(", ")} — that count prints the key`);
        }
    }

    if (missing.length > 0 || orphan.length > 0 || mismatched.length > 0) {
        problems.push({ locale, missing, orphan, mismatched });
    }
}

if (problems.length === 0) {
    console.log(
        `All ${locales.length} locales carry every one of the ${baseKeys.size} ${baseLocale} messages.`,
    );
    process.exit(0);
}

for (const { locale, missing, orphan, mismatched } of problems) {
    if (missing.length > 0) {
        console.error(`✗ ${locale}: missing ${missing.length} — ${missing.join(", ")}`);
    }
    if (orphan.length > 0) {
        console.error(
            `✗ ${locale}: orphan ${orphan.length} (not in ${baseLocale}) — ${orphan.join(", ")}`,
        );
    }
    if (mismatched.length > 0) {
        console.error(
            `✗ ${locale}: ${mismatched.length} message(s) interpolate different placeholders ` +
                `than ${baseLocale}:\n    ${mismatched.join("\n    ")}`,
        );
    }
}
console.error(
    `\n${problems.length} locale(s) out of sync with ${baseLocale}. Translate the missing keys ` +
        `into each messages/<locale>.json, remove the orphaned ones, and give every ` +
        `translation the same {placeholders} its ${baseLocale} message has — then re-run.`,
);
process.exit(1);
