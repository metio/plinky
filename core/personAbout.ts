// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What a composer page can say about the composer, beyond their pieces.
//
// A page that is a name and a list is thin for a reader and thin for a search engine
// alike, and there are four hundred of them. Wikidata describes nearly every one of these
// people in a line, in most of the languages the site speaks, under CC0 — so the page can
// say who somebody was, when they lived, and where to read more, without anybody writing
// four hundred biographies. dev/fetch-wikidata.mts collects it; dev/gen-people.mts writes
// one file per language beside the site; this is what reads it.

export type PersonAbout = {
    // The one-line description in the page's own language: "Polish composer and pianist".
    about?: string;
    born?: number;
    died?: number;
    // The Wikipedia article in this language, as a full URL.
    wikipedia?: string;
    // The Wikidata entity, which is what ties the page to the person everywhere else.
    id?: string;
};

export type PeopleAbout = Record<string, PersonAbout>;

// Own-property only: a bare lookup answers for "constructor" and every other name on
// Object's prototype, so /person/constructor would arrive carrying a function's details.
export function aboutFor(people: PeopleAbout, slug: string): PersonAbout | null {
    return Object.hasOwn(people, slug) ? (people[slug] as PersonAbout) : null;
}

// The years a person lived, as a page prints them: "1810–1849", "born 1935" for somebody
// still living, "died 1849" where only that is known. Nothing where neither is.
//
// The dash is an en dash, which is what a range is set with; the words come from the
// caller, since they are the only part of this that is language.
export function lifespan(
    about: PersonAbout,
    words: { born: (year: number) => string; died: (year: number) => string },
): string {
    if (about.born !== undefined && about.died !== undefined) {
        return `${about.born}–${about.died}`;
    }
    if (about.born !== undefined) {
        return words.born(about.born);
    }
    if (about.died !== undefined) {
        return words.died(about.died);
    }
    return "";
}

// The line under a composer's name: what they were, and when. Either half may be missing,
// and a page with neither prints nothing rather than an empty parenthesis.
export function aboutLine(
    about: PersonAbout,
    words: { born: (year: number) => string; died: (year: number) => string },
): string {
    const years = lifespan(about, words);
    if (about.about && years) {
        return `${about.about} (${years})`;
    }
    return about.about ?? years;
}

// The entity URLs that say this page and that record are the same person. A search engine
// reads `sameAs` as identity rather than as a citation, which is what turns four hundred
// generated pages into four hundred known people.
export function sameAsFor(about: PersonAbout): string[] {
    return [
        ...(about.id ? [`https://www.wikidata.org/wiki/${about.id}`] : []),
        ...(about.wikipedia ? [about.wikipedia] : []),
    ];
}
