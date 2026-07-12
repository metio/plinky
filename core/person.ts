// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// Composer identity for the person pages: the catalogue's composer strings come
// from many corpora that spell the same person a dozen ways — "J.S. Bach",
// "Johann Sebastian BACH", "Johann Sebastian Bach (1685 - 1750)". Canonicalizing
// them (and slugging the result) is what lets one composer own one page instead
// of shattering across variants.

// Well-known spellings that mechanical cleanup can't merge (initials versus the
// full name, translated "traditional" markers), keyed by the cleaned-up
// lowercase form. Small and curated: only entries that demonstrably occur in
// the catalogue's corpora belong here.
const ALIASES: Record<string, string> = {
    "j. s. bach": "Johann Sebastian Bach",
    "js bach": "Johann Sebastian Bach",
    bach: "Johann Sebastian Bach",
    "w. a. mozart": "Wolfgang Amadeus Mozart",
    "wa mozart": "Wolfgang Amadeus Mozart",
    mozart: "Wolfgang Amadeus Mozart",
    "l. v. beethoven": "Ludwig van Beethoven",
    beethoven: "Ludwig van Beethoven",
    "g. f. handel": "George Frideric Handel",
    "g. f. haendel": "George Frideric Handel",
    handel: "George Frideric Handel",
    "f. chopin": "Frédéric Chopin",
    chopin: "Frédéric Chopin",
    "f. schubert": "Franz Schubert",
    "p. i. tchaikovsky": "Pyotr Ilyich Tchaikovsky",
    tchaikovsky: "Pyotr Ilyich Tchaikovsky",
    "erik satie": "Erik Satie",
    trad: "Traditional",
    "trad.": "Traditional",
    traditional: "Traditional",
    traditionnel: "Traditional",
    anonymous: "Anonymous",
    anonymus: "Anonymous",
    anon: "Anonymous",
    "anon.": "Anonymous",
};

// Initials written tight ("J.S. Bach") spread to the spaced form ("J. S. Bach")
// so both spellings clean to the same key.
function spaceInitials(name: string): string {
    return name.replace(/\b([A-Z])\.(?=[A-Z]\.)/g, "$1. ");
}

// The mechanical cleanup shared by the canonical name and the grouping key:
// parenthesized asides (life dates, "published as …") and bare trailing date
// ranges go, "Last, First" flips, whitespace collapses.
function cleaned(raw: string): string {
    // Corpora that SHOUT a surname ("Johann Sebastian BACH") fold back to
    // title case; short all-caps runs stay, so initials survive.
    let name = raw.replace(
        /\b\p{Lu}{4,}\b/gu,
        (word) => word[0] + word.slice(1).toLowerCase(),
    );
    name = name.replace(/\s*\([^)]*\)/g, "");
    name = name.replace(/[\s,]*\d{4}\s*[-–—]?\s*(\d{4})?\s*$/g, "");
    const comma = name.indexOf(",");
    if (comma > 0 && comma < name.length - 1) {
        name = `${name.slice(comma + 1)} ${name.slice(0, comma)}`;
    }
    return name.replace(/\s+/g, " ").trim();
}

// The display name a person page carries: the cleaned spelling, routed through
// the alias table so well-known variants converge. An unknown or empty string
// canonicalizes to "" — no page.
export function canonicalComposer(raw: string): string {
    const name = cleaned(spaceInitials(raw));
    return ALIASES[name.toLowerCase()] ?? name;
}

// Attribution markers that name a tradition, not a human — they canonicalize
// for display ("trad." reads as Traditional) but never become a person: no
// link, no page. Matched as words anywhere in the credit, so an enriched
// attribution ("Traditional — …, 1761") stays a non-person too.
const NOT_A_PERSON = /\b(trad|traditional|traditionnel|anonymous|anonymus|anon)\b/i;

// The person's URL segment: the canonical name lowercased, diacritics stripped,
// anything non-alphanumeric folded to single hyphens — stable, readable, and
// safe in a path. Empty when the composer is unknown or is an attribution
// marker rather than a person.
export function personSlug(raw: string): string {
    if (NOT_A_PERSON.test(raw)) {
        return "";
    }
    return canonicalComposer(raw)
        .normalize("NFKD")
        .replace(/\p{M}/gu, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

// What a person page needs to know about one piece, whatever catalogue it
// came from.
export type PersonPiece = {
    id: string;
    title: string;
    composer: string;
    grade?: number;
    license?: string;
    source?: string;
};

export type Person = {
    slug: string;
    name: string;
    pieces: PersonPiece[];
};

// Group pieces by composer identity: one Person per slug, pieces sorted easy
// first (grade, then title), people sorted by how much of the catalogue they
// hold. Pieces with no usable composer are left out — they have no page.
export function peopleFrom(pieces: PersonPiece[]): Person[] {
    const bySlug = new Map<string, Person>();
    for (const piece of pieces) {
        const slug = personSlug(piece.composer);
        if (!slug) {
            continue;
        }
        const person = bySlug.get(slug) ?? {
            slug,
            name: canonicalComposer(piece.composer),
            pieces: [],
        };
        person.pieces.push(piece);
        bySlug.set(slug, person);
    }
    const people = [...bySlug.values()];
    for (const person of people) {
        person.pieces.sort(
            (a, b) =>
                (a.grade ?? Number.POSITIVE_INFINITY) - (b.grade ?? Number.POSITIVE_INFINITY) ||
                a.title.localeCompare(b.title),
        );
    }
    return people.sort((a, b) => b.pieces.length - a.pieces.length || a.name.localeCompare(b.name));
}

// The one person a page shows, or null when nothing in the catalogue matches
// the slug.
export function personFor(pieces: PersonPiece[], slug: string): Person | null {
    return peopleFrom(pieces).find((person) => person.slug === slug) ?? null;
}
