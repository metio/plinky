// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The mechanical tidying every harvested title and credit gets, applied by
// `npm run songs:bake` and gated by it.
//
// This is the half of catalogue cleanup that needs no judgement: an entity that should
// have been decoded, a URL pasted into a field meant for a name, a title typed entirely in
// lower case. Rules rather than entries in dev/catalog-curation.json, because there are
// fifty-seven lower-case titles and because a rule also catches whatever the next import
// brings — curation is for the cases where somebody has to decide what a thing is called.
//
// What is deliberately NOT tidied:
//
//   • "Nr." and "N°". They are correct German and French, they appear in German and French
//     titles, and rewriting them to "No." would anglicize a title in its own language. The
//     catalogue holds music from everywhere and spells it as its own language does.
//   • Capitalization beyond the first letter. German capitalizes its nouns, French usually
//     capitalizes only the first word, and English disagrees with itself about the small
//     words — there is no rule here that is right in every language, so the first letter is
//     as far as this goes.
//   • Anything that would need to know what a piece is. A title cut off mid-phrase, or a
//     cataloguing note where a title should be, is a curation entry.

const ENTITIES: [RegExp, string][] = [
    [/&quot;/gi, '"'],
    [/&apos;|&#39;/gi, "'"],
    [/&lt;/gi, "<"],
    [/&gt;/gi, ">"],
    [/&nbsp;/gi, " "],
    // Ampersand last: decoding it first would turn "&amp;quot;" into a quote.
    [/&amp;/gi, "&"],
];

// A link, however it was written. The bare-domain arm is deliberately limited to common
// top-level domains: a token with a dot in it is a word far more often than it is a host,
// and "St. Louis" must survive.
const LINK =
    /https?:\/\/\S+|\bwww\.\S+|\b[\w-]+\.(?:com|de|org|net|fr|es|it|uk|ch|at|nl|info|io)\b(?:\/\S*)?/gi;

// Decode, unlink, and close up the gaps that leaves. Shared by titles and credits, since a
// URL is as unwelcome in one as the other.
export function tidyCredit(text: string): string {
    let out = text;
    for (const [pattern, replacement] of ENTITIES) {
        out = out.replace(pattern, replacement);
    }
    out = out.replace(LINK, " ");
    return out
        .replace(/\s+/g, " ")
        .replace(/^[\s,;:.\-–—]+/, "")
        .replace(/[\s,;:\-–—]+$/, "")
        .trim();
}

// A title, additionally given a capital letter when it has none at all.
//
// Only when it has none: a title with any capital in it has been typed by somebody who
// meant it, and "eine kleine Nachtmusik" is not for a script to argue with.
export function tidyTitle(text: string): string {
    const tidied = tidyCredit(text);
    if (/\p{Lu}/u.test(tidied) || !/\p{Ll}/u.test(tidied)) {
        return tidied;
    }
    const first = tidied.search(/\p{L}/u);
    return first < 0
        ? tidied
        : tidied.slice(0, first) + tidied[first]!.toUpperCase() + tidied.slice(first + 1);
}

// Tidying that empties a field has not tidied it — it has deleted it. A title that was
// nothing but a URL keeps its URL until somebody curates it a real one, because a piece
// with no name at all cannot be found or reported.
export function tidied(text: string, tidy: (value: string) => string): string {
    const next = tidy(text);
    return next === "" ? text : next;
}
