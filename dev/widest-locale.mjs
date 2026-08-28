// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Which language stresses a narrow layout hardest, printed for a build to use.
//
// The width gate used to measure the English build, which is the one language whose
// layout nobody needs to check: every string in the app was written to fit in it. What
// breaks a 320px page is a word that cannot be broken — a German compound noun, a Danish
// authority's name — because a single unwrappable token drags the whole document sideways
// and takes every page with it.
//
// So the locale is derived rather than picked. A hand-picked one is right on the day it is
// chosen and silently wrong after the next round of translation; this reads the messages
// the build is about to compile and names the worst of them, and says why.
//
// Scripts that wrap between characters are left out. Japanese and Chinese have no spaces,
// so their "longest word" is a whole sentence and means nothing here — a browser breaks
// those lines anywhere it likes.

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

// Printed bare on stdout so a shell can build with it: PLINKY_LOCALE=$(node …).
// The reasoning goes to stderr, where it is read by a person and ignored by the shell.
if (import.meta.url === `file://${process.argv[1]}`) {
    const best = widestLocale();
    console.error(
        `Widest locale: ${best.locale} — "${best.token}" (${best.length} characters, ${best.key})`,
    );
    console.log(best.locale);
}
