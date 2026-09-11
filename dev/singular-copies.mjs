// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Finds counted messages whose singular reads exactly like the plural, in a language that
// tells the two apart. A translation that copies the plural into the singular arm compiles,
// interpolates the right placeholders and covers every plural category, so each of the
// other checks passes it — and a German player reads "1 Noten". Nothing at runtime can tell
// a copied plural from a word that happens to read the same, so the few words that really do
// are named here, each with the reason.
//
// Two shapes of counted message exist: a `_one`/`_other` pair the caller branches between,
// and paraglide's plural message, whose arms the locale's plural rules choose. A pair is a
// copy when the two strings are equal. A plural message is a copy when every arm reads the
// same: Croatian and Serbian say "1 nota" and "5 nota" and differ only at "2 note", so
// comparing the `one` arm with `other` alone would condemn a correct translation.

// Languages whose numerals take the singular noun, so one and many read the same in every
// counted message: Hungarian "3 darab", Turkish "3 parça".
const SINGULAR_AFTER_NUMERAL = new Set(["hu", "tr"]);

const INVARIANT_PJESE = "pjesë is one word for one piece and several";
const INVARIANT_DITE = "ditë is one word for one day and several";
const FINNISH_CASE =
    "the noun takes the numeral's case in the singular: yhtenä päivänä, kolmena päivänä";

// Messages that read the same for one and many because of the word itself, keyed by locale
// and then by message (a pair by its name without `_one`/`_other`).
const SAME_FOR_ONE_AND_MANY = {
    cs: {
        music_remove_used: "zadání reads the same for one and five, and so does the verb",
    },
    fi: {
        music_remove_used: FINNISH_CASE,
        repertoire_days_left: FINNISH_CASE,
        stats_opening_days: FINNISH_CASE,
        stats_opening_days_more: FINNISH_CASE,
    },
    sq: {
        review_start: INVARIANT_PJESE,
        today_review: INVARIANT_PJESE,
        today_stand: INVARIANT_PJESE,
        balance_last: INVARIANT_DITE,
        repertoire_days_left: INVARIANT_DITE,
        stats_opening_days: INVARIANT_DITE,
        stats_opening_days_more: INVARIANT_DITE,
    },
    sv: {
        progress_backup_items: "objekt is one word for one item and several",
    },
};

const isComplex = (value) =>
    Array.isArray(value) && typeof value[0]?.match === "object" && value[0].match !== null;

// Every counted message in one locale's catalogue, as its name and whether all its forms
// read the same.
function countedMessages(messages) {
    const counted = [];
    for (const [key, value] of Object.entries(messages)) {
        if (key.endsWith("_one") && typeof value === "string") {
            const name = key.slice(0, -"_one".length);
            const other = messages[`${name}_other`];
            if (typeof other === "string") {
                counted.push({ name, same: value === other });
            }
        } else if (isComplex(value)) {
            const arms = Object.values(value[0].match);
            if (arms.length > 1) {
                counted.push({ name: key, same: arms.every((arm) => arm === arms[0]) });
            }
        }
    }
    return counted;
}

// What is wrong with one locale's counted messages, one line per problem: a singular copied
// from the plural, or an exemption that no longer describes any message. An exemption that
// outlives its message would quietly excuse the next copy made under that name.
export function singularCopies(locale, messages, exemptions = SAME_FOR_ONE_AND_MANY) {
    const categories = new Intl.PluralRules(locale).resolvedOptions().pluralCategories;
    if (!categories.includes("one") || SINGULAR_AFTER_NUMERAL.has(locale)) {
        return [];
    }
    const allowed = exemptions[locale] ?? {};
    const problems = [];
    const excused = new Set();
    for (const { name, same } of countedMessages(messages)) {
        if (!same) {
            continue;
        }
        if (Object.hasOwn(allowed, name)) {
            excused.add(name);
        } else {
            problems.push(`${name}: the singular reads exactly like the plural`);
        }
    }
    for (const name of Object.keys(allowed)) {
        if (!excused.has(name)) {
            problems.push(
                `${name}: listed as reading the same for one and many, but no longer does — ` +
                    "drop it from SAME_FOR_ONE_AND_MANY in dev/singular-copies.mjs",
            );
        }
    }
    return problems;
}
