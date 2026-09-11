// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The shape of a counted message, shared by every gate that reads one. A message is either
// a plain string or the message-format plugin's plural form: an array whose first element
// carries the variants, keyed "countPlural=one", "countPlural=few" and so on. Two gates
// that disagreed about which messages are counted would each pass what the other exists to
// catch, so the predicate lives here once.

export const isComplex = (value) =>
    Array.isArray(value) && typeof value[0]?.match === "object" && value[0].match !== null;

// The text of every arm, for a check that only wants to read the words.
export const armsOf = (value) => (isComplex(value) ? Object.values(value[0].match) : [value]);

// What is wrong with the plural forms of one locale's messages, one line per problem.
//
// A plural message must answer for every category its OWN language can produce. Paraglide
// compiles the variants into a chain of comparisons and, when none matches, returns the
// message key — so a Polish count of five in a message carrying only `one` and `other` does
// not read a little oddly, it prints "progress_backup_items" on the page. The categories are
// not a matter of taste, so they are asked of Intl rather than listed here, and they differ
// per language: Polish needs four, Croatian three, Japanese one. The contract is held to it
// like every translation, since a typo in its own arms breaks English the same way.
//
// And a message the contract counts stays counted: written as one plain string, it renders
// the same words for every number and escapes the check for a singular copied from the
// plural, which only reads plural messages.
export function pluralProblems(locale, messages, contract = messages) {
    const needed = new Intl.PluralRules(locale).resolvedOptions().pluralCategories;
    const problems = [];
    for (const [key, value] of Object.entries(messages)) {
        if (!isComplex(value)) {
            if (typeof value === "string" && isComplex(contract[key])) {
                problems.push(`${key}: counted in the contract, but one plain form here`);
            }
            continue;
        }
        const arms = new Set(Object.keys(value[0].match).map((arm) => arm.split("=").at(-1)));
        const absent = needed.filter((category) => !arms.has(category));
        if (absent.length > 0) {
            problems.push(`${key}: no arm for ${absent.join(", ")} — that count prints the key`);
        }
    }
    return problems;
}
