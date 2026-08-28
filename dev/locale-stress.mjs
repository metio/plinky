// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Which language stresses the app hardest, printed for a build to measure.
//
// Every per-visitor gate used to build English, which is the one language none of them
// needed to check: every string in the app was written to fit in it, and it is the
// shortest. What a gate is actually asserting is a claim about visitors, and different
// visitors download different languages.
//
// Two kinds of worst case, because the gates ask two different questions:
//
//   --widest    the longest word a line cannot be broken inside. This is what drags a
//               320px page sideways and takes every page with it — a German compound
//               noun, a Danish authority's name.
//   --heaviest  the most message text by bytes, which is what a visitor downloads.
//               Greek ships 2.07x the English bytes; measured, that is 21.8 KB of real
//               weight that the size budget never saw because it only ever weighed en.
//
// Derived rather than picked, in both cases. A hand-chosen locale is right on the day it
// is chosen and silently wrong after the next round of translation; this reads the
// messages the build is about to compile and names the worst of them, and says why.
//
// For the widest, scripts that wrap between characters are left out: Japanese and Chinese
// have no spaces, so their "longest word" is a whole sentence and means nothing here.

import { readdirSync, readFileSync } from "node:fs";

const DIR = "messages";

// A character a line may break after even mid-word. If a token holds one of these it
// cannot force an overflow, however long it is.
const BREAKS_ANYWHERE = /[　-〿぀-ゟ゠-ヿ㐀-䶿一-鿿豈-﫿฀-๿]/;

// An interpolation. Removed rather than measured: `{composer}` is a placeholder name,
// not a word anybody reads, and the value that replaces it is not known here. Every
// locale carries the same interpolations anyway, so they cannot tell them apart.
const INTERPOLATION = /\{[^}]*\}/g;

// Punctuation a browser will also break after.
const SEPARATORS = /[\s <>/#.,;:!?()[\]"'’“”—–-]+/;

export function widestLocale(dir = DIR) {
    let best = { locale: "en", token: "", length: 0, key: "" };
    for (const file of readdirSync(dir).filter((name) => name.endsWith(".json"))) {
        const locale = file.replace(/\.json$/, "");
        const messages = JSON.parse(readFileSync(`${dir}/${file}`, "utf8"));
        for (const [key, value] of Object.entries(messages)) {
            if (typeof value !== "string" || key.startsWith("$")) {
                continue;
            }
            for (const token of value.replace(INTERPOLATION, " ").split(SEPARATORS)) {
                if (token.length > best.length && !BREAKS_ANYWHERE.test(token)) {
                    best = { locale, token, length: token.length, key };
                }
            }
        }
    }
    return best;
}

// The language whose messages weigh the most, which is the most any visitor downloads.
//
// Measured in UTF-8 bytes rather than characters on purpose: a Greek or Cyrillic letter is
// two bytes where a Latin one is one, and bytes are what crosses the network. Japanese is
// the opposite case and the reason this is not counted in characters — it says the most in
// the fewest of them.
export function heaviestLocale(dir = DIR) {
    let best = { locale: "en", bytes: 0 };
    for (const file of readdirSync(dir).filter((name) => name.endsWith(".json"))) {
        const messages = JSON.parse(readFileSync(`${dir}/${file}`, "utf8"));
        const bytes = Object.entries(messages)
            .filter(([key, value]) => typeof value === "string" && !key.startsWith("$"))
            .reduce((total, [, value]) => total + Buffer.byteLength(value, "utf8"), 0);
        if (bytes > best.bytes) {
            best = { locale: file.replace(/\.json$/, ""), bytes };
        }
    }
    return best;
}

// Printed bare on stdout so a shell can build with it: PLINKY_LOCALE=$(node …).
// The reasoning goes to stderr, where it is read by a person and ignored by the shell.
if (import.meta.url === `file://${process.argv[1]}`) {
    if (process.argv.includes("--heaviest")) {
        const best = heaviestLocale();
        console.error(`Heaviest locale: ${best.locale} — ${best.bytes} bytes of message text`);
        console.log(best.locale);
    } else {
        const best = widestLocale();
        console.error(
            `Widest locale: ${best.locale} — "${best.token}" (${best.length} characters, ${best.key})`,
        );
        console.log(best.locale);
    }
}
