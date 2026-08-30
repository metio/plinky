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
//   --scripts   the hardest locale of EACH WRITING SYSTEM, one per line. The two worst
//               cases above answer "how long" and "how heavy", and both are sound
//               arguments about LENGTH: if the longest word fits, every shorter one does.
//               Neither says anything about SHAPE. Korean, Japanese and Chinese are the
//               SHORTEST of the twenty-six by character count, so they are never the worst
//               case and never swept — while having the tallest glyphs, entirely different
//               line-breaking, and the best chance of falling back to another font. A
//               Korean label breaking a control ships green today and no length-based proxy
//               can catch it.
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

// Which writing system a locale is actually set in, read off its own text rather than
// mapped from its name: a language can be written in more than one script, and this repo
// has already had to fix Serbian being assumed Latin when it ships Cyrillic.
const SCRIPTS = [
    ["han", /[\u4e00-\u9fff]/],
    ["kana", /[\u3040-\u30ff]/],
    ["hangul", /[\uac00-\ud7af\u1100-\u11ff]/],
    ["cyrillic", /[\u0400-\u04ff]/],
    ["greek", /[\u0370-\u03ff]/],
];

export function scriptOf(text) {
    const counts = SCRIPTS.map(([name, pattern]) => [
        name,
        [...text].filter((character) => pattern.test(character)).length,
    ]);
    const [name, count] = counts.reduce((best, one) => (one[1] > best[1] ? one : best));
    // Below a floor it is a stray glyph in a Latin string — a Greek letter in a music term,
    // a Cyrillic name in a credit — rather than the language's own script.
    return count > text.length / 20 ? name : "latin";
}

// The locale that stresses layout hardest within each writing system: the same longest-word
// measure, applied per script instead of once across all of them. Sweeping these covers the
// shapes a page can be asked to hold, which is the thing one worst case cannot.
export function localesByScript(dir = DIR) {
    const hardest = new Map();
    for (const file of readdirSync(dir).filter((name) => name.endsWith(".json"))) {
        const locale = file.replace(/\.json$/, "");
        const messages = JSON.parse(readFileSync(`${dir}/${file}`, "utf8"));
        const text = Object.entries(messages)
            .filter(([key, value]) => typeof value === "string" && !key.startsWith("$"))
            .map(([, value]) => value)
            // The values, and joined with a space rather than with nothing. Keep the keys
            // and the longest "word" is a message id, which every locale shares, so they all
            // measure the same; join with nothing and the end of one string fuses to the
            // start of the next. Both mistakes were made here, and both name the wrong
            // locale confidently.
            .join(" ");
        const script = scriptOf(text);
        // Within a script that wraps between characters there is no longest word to compare,
        // so the most text wins: it is the one that fills the most room.
        const measure = BREAKS_ANYWHERE.test(text)
            ? text.length
            : Math.max(
                  0,
                  ...text
                      .replace(INTERPOLATION, " ")
                      .split(SEPARATORS)
                      .map((t) => t.length),
              );
        const held = hardest.get(script);
        if (held === undefined || measure > held.measure) {
            hardest.set(script, { locale, measure });
        }
    }
    return [...hardest.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([script, { locale }]) => ({ script, locale }));
}

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
    if (process.argv.includes("--scripts")) {
        const found = localesByScript();
        console.error(
            `One locale per writing system: ${found.map((one) => `${one.locale} (${one.script})`).join(", ")}`,
        );
        console.log(found.map((one) => one.locale).join(" "));
    } else if (process.argv.includes("--heaviest")) {
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
