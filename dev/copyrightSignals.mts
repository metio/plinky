// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// A best-effort denylist of well-known copyrighted recording artists, songwriters, and
// film/game composers whose work pervades user-uploaded "cover" datasets like PDMX.
//
// IMPORTANT: this is a MITIGATION, not a solution. Copyright cannot be detected
// reliably from metadata — this only catches entries whose composer field names a
// famous copyrighted act, removing the obvious ones wrongly tagged CC0. It will miss
// lesser-known copyrighted songs, and the real fix is a curated public-domain allowlist
// or a properly licensed catalogue. "arr. by"/"transcribed"/"arranged" are deliberately
// NOT signals — public-domain works (Bach, Rossini…) are arranged and transcribed too.

// Matched as whole words against the lower-cased composer field, so "queen" hits the
// band but not "Carole Queening", and "lennon" hits John or Julian Lennon.
const ARTISTS = [
    "beatles", "lennon", "mccartney", "elton john", "queen", "freddie mercury", "oasis",
    "gallagher", "coldplay", "ed sheeran", "adele", "taylor swift", "justin bieber",
    "bieber", "billie eilish", "bruno mars", "lady gaga", "beyonce", "rihanna",
    "katy perry", "imagine dragons", "maroon 5", "onerepublic", "the weeknd", "weeknd",
    "dua lipa", "post malone", "michael jackson", "madonna", "whitney houston",
    "mariah carey", "bring me the horizon", "nickelback", "soundgarden", "nirvana",
    "radiohead", "red hot chili peppers", "linkin park", "green day", "metallica",
    "guns n roses", "bon jovi", "aerosmith", "rolling stones", "pink floyd",
    "led zeppelin", "david bowie", "bowie", "moody blues", "tones and i",
    "lewis capaldi", "sam smith", "shawn mendes", "charlie puth", "twenty one pilots",
    "panic at the disco", "fall out boy", "my chemical romance", "hans zimmer",
    "john williams", "ennio morricone", "joe hisaishi", "yann tiersen", "ludovico einaudi",
    "einaudi", "yiruma", "alan walker", "marshmello", "avicii", "daft punk",
    "frank sinatra", "antonio carlos jobim", "carlos jobim", "stevie wonder",
    "elvis presley", "abba", "bee gees", "madness", "sia", "lorde", "halsey", "khalid",
    "lana del rey", "ariana grande", "harry styles", "olivia rodrigo", "doja cat",
    "the script", "snow patrol", "keane", "muse", "foo fighters", "weezer", "blur",
    "amy winehouse", "john legend", "alicia keys", "passenger", "birdy", "tones",
    "evanescence", "system of a down", "rammstein", "gorillaz", "the cranberries",
    "michel legrand", "burt bacharach", "richard clayderman", "andrew lloyd webber",
];

const PATTERN = new RegExp(`\\b(${ARTISTS.map((a) => a.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\b`);

// Returns the matched copyrighted-artist signal, or null. Checks the composer field
// (the reliable signal); the title is too noisy to match safely.
export function copyrightReason(composer: string): string | null {
    const match = composer.toLowerCase().match(PATTERN);
    return match ? match[1]! : null;
}
