// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

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
    // Variants the shipped catalogue actually credits, found by baking the composer
    // index (dev/bake-people.mts) and reading what came out. Each of these owned a
    // separate page — and a separate "more by this composer" list — until it was
    // merged here, so the table is what stops one person from being several.
    "a. scriabin": "Alexander Scriabin",
    scriabin: "Alexander Scriabin",
    "c. czerny": "Carl Czerny",
    czernyc: "Carl Czerny",
    czerny: "Carl Czerny",
    "j. brahms": "Johannes Brahms",
    brahms: "Johannes Brahms",
    "l. van beethoven": "Ludwig van Beethoven",
    "f. liszt": "Franz Liszt",
    liszt: "Franz Liszt",
    "m. ravel": "Maurice Ravel",
    ravel: "Maurice Ravel",
    "n. rimsky-korsakov": "Nikolai Rimsky-Korsakov",
    "chopinff": "Frédéric Chopin",
    // Misspellings, each carried by a single score. Mechanical cleanup cannot reach these
    // — nothing in the string says it is wrong — so a page held one piece under a name a
    // letter away from the composer's, invisible from his own page and too thin to be
    // prerendered. Found by baking the index and comparing rare names against populated
    // ones; a manifest edit would not have lasted, since the import scripts rewrite it.
    "craude debussy": "Claude Debussy",
    "calude debussy": "Claude Debussy",
    "wolfgang amedeus mozart": "Wolfgang Amadeus Mozart",
    "eric satie": "Erik Satie",
    "george frederic handel": "George Frideric Handel",
    "edward grieg": "Edvard Grieg",
    // A transliteration rather than an error, folded because one catalogue should spell a
    // person one way.
    "sergeï rachmaninov": "Sergei Rachmaninoff",
    // The only credit in the catalogue carrying a Ravel catalogue number, which the
    // work-number stripping does not know ("M." is not among the prefixes it recognises).
    // One entry rather than a new prefix: a bare "M" before digits is a likelier initial
    // than a catalogue mark.
    "maurice ravel m. 19": "Maurice Ravel",
    "nikolai andreyevitch rimsky-korsakov": "Nikolai Rimsky-Korsakov",
    "frédérick chopin": "Frédéric Chopin",
    "g. f. händel": "George Frideric Handel",
    "georg friedrich händel": "George Frideric Handel",
    "haendel": "George Frideric Handel",
    "händel": "George Frideric Handel",
    "a. vivaldi": "Antonio Vivaldi",
    "antónio vivaldi": "Antonio Vivaldi",
    vivaldi: "Antonio Vivaldi",
    "a. goedicke": "Alexander Goedicke",
    "felix mendelssohn-bartholdy": "Felix Mendelssohn",
    mendelssohn: "Felix Mendelssohn",
    "augusta mary anne holmès": "Augusta Holmès",
    "clara mathilda faisst": "Clara Faisst",
    "alexander campbell mackenzie": "Alexander Mackenzie",
    "friedrich burgmüller": "Johann Friedrich Franz Burgmüller",
    "johann friedrich franz burgmüller opus 100": "Johann Friedrich Franz Burgmüller",
    "l. streabbog": "Louis Streabbog",
    "frederik kuhlau": "Friedrich Kuhlau",
    "by scott joplin": "Scott Joplin",
    "john philip sousa": "John Philip Sousa",
};

// Initials written tight spread to the spaced form, so every spelling of the same
// credit cleans to one key: "J.S. Bach" and "A.Scriabin" both gain the space, which is
// what lets a single alias entry catch them. A single capital before the dot is what
// makes it an initial — "St." and "Op." are left alone.
function spaceInitials(name: string): string {
    return name.replace(/\b([A-Z])\.(?=\p{L})/gu, "$1. ");
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
    // Corpora that passed their credits through an HTML pipeline leak entities into
    // the name — a page reading `Claribel&quot;` is the credit failing in public.
    name = name
        .replace(/&quot;/gi, '"')
        .replace(/&amp;/gi, "&")
        .replace(/&#39;|&apos;/gi, "'");
    name = name.replace(/\s*\([^)]*\)/g, "");
    // A bracketed aside ("[published as …]") is about the work or the pen name, not
    // the person, and would otherwise split one composer across two pages.
    name = name.replace(/\s*\[[^\]]*\]/g, "");
    // A work number appended to the credit ("… Opus 100.", "Op.11.No.1") names the
    // piece, not its composer — so it and everything after it goes. But only when a
    // name survives in front of it: some corpora write the work number FIRST
    // ("Op 39, No. 15 Johannes Brahms"), and stripping to the end there would delete
    // the composer entirely and leave the piece credited to nobody.
    // Leading work numbers first, as many as are stacked up ("Op 39, No. 15 Brahms"),
    // each dropped on its own so the name behind them survives.
    const LEADING_WORK = /^[\s,.]*\b(op|opus|no|nr|bwv|kv|k)\b\.?\s*[\d.]+[\s,.]*/i;
    while (LEADING_WORK.test(name)) {
        name = name.replace(LEADING_WORK, "");
    }
    // Then a trailing one, which takes everything after it — but only if a name is left
    // in front. Otherwise the credit was nothing but a work number and there is no
    // composer to keep.
    const withoutWork = name.replace(/[\s,]*\b(op|opus|no|nr|bwv|kv|k)\b\.?\s*\d+[\d.\s]*.*$/i, "");
    if (withoutWork.trim().length > 0) {
        name = withoutWork;
    }
    name = name.replace(/[\s,]*\d{4}\s*[-–—]?\s*(\d{4})?\s*$/g, "");
    const comma = name.indexOf(",");
    if (comma > 0 && comma < name.length - 1) {
        name = `${name.slice(comma + 1)} ${name.slice(0, comma)}`;
    }
    // A trailing full stop is punctuation from the credit line, never part of a name.
    return name.replace(/\s+/g, " ").replace(/[.,;:]+$/, "").trim();
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
const NOT_A_PERSON =
    /\b(trad|traditional|traditionnel|anonymous|anonymus|anon|volkslied|gregorian|plainchant|folk\s?song|spiritual|shanty)\b/i;

// The longest a credit can be and still be somebody's name. Real ones run well under
// this — the catalogue's longest genuine composer is "Corona Elisabeth Wilhelmine
// Schröter" at 36 characters — and what runs past it is a sentence: one credit carries a
// paragraph of singing instructions in French.
const LONGEST_NAME = 80;

// A credit that cannot be anybody, whatever it says. The harvested corpora put source
// URLs, contact addresses and hymn-tune codes in the composer field, and until the
// directory listed every composer these were hidden by the piece-count floor the
// prerender index happens to apply — the junk simply never reached three pieces. A person
// page for a URL helps nobody, and the first name in an alphabetical directory should not
// be a hymnary.org link.
//
// Deliberately only the certain cases. "Composer: Johann Sebastian Bach Transcribed by:
// ekoi" is a clumsy credit for a real person, and guessing at those with a regex would
// cost more than it saved; those are for dev/catalog-curation.json.
function cannotBeAPerson(name: string): boolean {
    return (
        name.length > LONGEST_NAME ||
        /https?:|www\.|@/.test(name) ||
        // Nothing to read as a name: a bare catalogue code, or digits alone.
        !/\p{L}/u.test(name)
    );
}

// The person's URL segment: the canonical name lowercased, diacritics stripped,
// anything non-alphanumeric folded to single hyphens — stable, readable, and
// safe in a path. Empty when the composer is unknown or is an attribution
// marker rather than a person.
export function personSlug(raw: string): string {
    // Tested against the CLEANED name, not the raw credit. A parenthetical or bracketed
    // aside describes the arrangement rather than the author — "Harry Thacker Burleigh
    // (arranged from a traditional Negro Spiritual)" is a piece BY Burleigh — and
    // testing before that aside is stripped hands his work to nobody.
    const name = canonicalComposer(raw);
    if (NOT_A_PERSON.test(name) || cannotBeAPerson(name)) {
        return "";
    }
    return name
        .normalize("NFKD")
        .replace(/\p{M}/gu, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

// The best a slug can be turned back into a name, for the composer nobody in the
// catalogue is credited as — a player's own import, or a hand-typed URL. The slug has
// lost the diacritics and the capitalisation, so this recovers only word boundaries;
// a name the catalogue does know is always read from the catalogue instead.
export function nameFromSlug(slug: string): string {
    return slug
        .split("-")
        .filter(Boolean)
        .map((word) => (word[0] ?? "").toUpperCase() + word.slice(1))
        .join(" ");
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
    // The piece's opening bars as the manifest bakes them, so a composer's list can be
    // read as music rather than as a column of titles.
    incipit?: string;
};

export type Person = {
    slug: string;
    name: string;
    pieces: PersonPiece[];
};

// Group pieces by composer identity: one Person per slug, pieces sorted easy
// first (grade, then title), people sorted by how much of the catalogue they
// hold. Pieces with no usable composer are left out — they have no page.
// Who the catalogue credits and how much of theirs there is — the directory's whole
// question, and none of the rest of peopleFrom's answer.
export type PersonCount = { slug: string; name: string; pieces: number };

// Grouping every piece by composer means canonicalizing thousands of credits, which is a
// regex chain apiece — but a catalogue of three thousand pieces holds only a few hundred
// distinct spellings, so the answer is cached per raw string and each one is worked out
// once. Building no per-composer piece lists and sorting none of them is the rest of the
// saving: peopleFrom does both, at some cost, for a page that reads them.
export function composerCounts(pieces: readonly { composer: string }[]): PersonCount[] {
    const resolved = new Map<string, { slug: string; name: string } | null>();
    const counts = new Map<string, PersonCount>();
    for (const piece of pieces) {
        let identity = resolved.get(piece.composer);
        if (identity === undefined) {
            const slug = personSlug(piece.composer);
            identity = slug ? { slug, name: canonicalComposer(piece.composer) } : null;
            resolved.set(piece.composer, identity);
        }
        if (!identity) {
            continue;
        }
        const seen = counts.get(identity.slug);
        if (seen) {
            seen.pieces += 1;
        } else {
            counts.set(identity.slug, { ...identity, pieces: 1 });
        }
    }
    return [...counts.values()].sort((a, b) => a.name.localeCompare(b.name));
}

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
    // Narrow to this composer's pieces first, then group. Grouping the whole catalogue
    // and keeping one of the result builds five hundred people and sorts every one of
    // their piece lists to answer a question about a single person. The slug of a credit
    // is cached per raw string, because three thousand pieces carry only a few hundred
    // distinct spellings and canonicalizing one is a chain of regexes.
    const slugs = new Map<string, string>();
    const mine = pieces.filter((piece) => {
        let seen = slugs.get(piece.composer);
        if (seen === undefined) {
            seen = personSlug(piece.composer);
            slugs.set(piece.composer, seen);
        }
        return seen === slug;
    });
    return mine.length > 0 ? (peopleFrom(mine)[0] ?? null) : null;
}
