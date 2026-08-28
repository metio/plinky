// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The pieces worth leading with: recognisable in three seconds, solo piano, and CC0, so
// nothing is owed by a post that carries only the picture. Ids are content fingerprints, so
// a re-import that changes the notes changes the id and this list stops matching — which is
// the failure we want (a missing piece), not a silently different one. `npm run promo:check`
// is what turns that failure into a red gate rather than a line in a render log: three of
// these were songs with a piano part rather than piano music, and one had stopped resolving
// at all, and a whole-catalogue render said so once each and carried on.
//
// One list, read by the video renderer and by the thumbnail generator, so a clip and its
// thumbnail can never be of different pieces.
//
// The titles and credits here are written for a video card and are meant to differ from the
// catalogue's: "Canon in D" rather than "Canon and Gigue in D major P.37", "J. S. Bach"
// rather than the credit line a corpus supplied. Most of these already read
// differently from the manifest, and that is the point — a title with three seconds to land
// is not the title a catalogue entry needs. Do not sync them.

export const PIECES = [
    { id: "TOBNVaraGATl", title: "Gymnopédie No. 1", composer: "Erik Satie" },
    { id: "peJ0t6fhDKjp", title: "Gnossienne No. 1", composer: "Erik Satie" },
    { id: "VYBNsVqZzqa9", title: "Valses distinguées No. 2", composer: "Erik Satie" },
    { id: "yORzpFl5Dpfi", title: "Prelude in C, BWV 846", composer: "J. S. Bach" },
    { id: "GFdSJIBHjLm1", title: "Canon in D", composer: "Johann Pachelbel" },
    { id: "o8LaALuzoRx1", title: "Für Elise", composer: "Ludwig van Beethoven" },
    { id: "8EKlMBPOS5dj", title: "The Entertainer", composer: "Scott Joplin" },
    { id: "zCR5qNmpjcYD", title: "Solace", composer: "Scott Joplin" },
    { id: "3hknjVHy3gan", title: "Clair de lune (opening)", composer: "Claude Debussy" },
    { id: "0nlCL3JvtjCl", title: "Nocturne in C-sharp minor", composer: "Frédéric Chopin" },
    { id: "gZKH4xnshzeG", title: "Fantaisie-impromptu, Op. 66", composer: "Frédéric Chopin" },
    { id: "GwgHLdwI1tJU", title: "Nocturnes, Op. 9", composer: "Frédéric Chopin" },
    { id: "y93KGmDQoD12", title: "Nocturne in E minor, Op. 72 No. 1", composer: "Frédéric Chopin" },
    { id: "wx8UhU1HozEL", title: "Waltzes, Op. 64", composer: "Frédéric Chopin" },
    { id: "8f3TJUVUEjfo", title: "Waltzes, Op. 69", composer: "Frédéric Chopin" },
    { id: "SvMHyl2yF7YS", title: "Waltz in A minor, B. 150", composer: "Frédéric Chopin" },
    { id: "YG1UemgwoxnB", title: "Wedding March", composer: "Felix Mendelssohn" },
    { id: "yxW1jGFJPEcF", title: "Anitra's Dance", composer: "Edvard Grieg" },
    { id: "GGAHdvH4ToTQ", title: "Peer Gynt, Op. 23", composer: "Edvard Grieg" },
    { id: "TaKfOgLMeIML", title: "L'arabesque", composer: "Friedrich Burgmüller" },
    { id: "voMStN2RqgVX", title: "Ave Maria", composer: "Bach / Gounod" },
    { id: "sHg7w3g0Ftdp", title: "Minuet in G, BWV Anh. 114", composer: "J. S. Bach" },
    { id: "XnWdH7iBpFxq", title: "Minuet in F, BWV Anh. 113", composer: "J. S. Bach" },
    { id: "VktWWxpyGanX", title: "Three Minuets, BWV 841–843", composer: "J. S. Bach" },
    { id: "bZUPLkmV2Sso", title: "Invention No. 2", composer: "J. S. Bach" },
    { id: "FSDn0qToFT6V", title: "Invention No. 4", composer: "J. S. Bach" },
    { id: "ArKsvazw6Ofb", title: "Invention No. 8", composer: "J. S. Bach" },
    { id: "YhKornCQUYEZ", title: "Invention No. 13", composer: "J. S. Bach" },
    { id: "mE1ACsw4hInO", title: "Invention in A minor, BWV 784", composer: "J. S. Bach" },
    { id: "GU05sH6kjHJv", title: "English Suite II: Bourrée I", composer: "J. S. Bach" },
    { id: "WnXMoVJk3TIQ", title: "Ich ruf zu dir, BWV 639", composer: "J. S. Bach" },
    { id: "9HqvitzGxsvD", title: "Sonatina, Op. 36 No. 1", composer: "Muzio Clementi" },
    { id: "aDxFLZmRT3qy", title: "Sonatina No. 1", composer: "Muzio Clementi" },
    { id: "dkPRbyhkMLiF", title: "Sonatina, Op. 20 No. 1", composer: "Friedrich Kuhlau" },
    { id: "KFCmkxaetLyO", title: "Sonatina in A minor", composer: "Carl Reinecke" },
    { id: "Kt5xcTPhESM3", title: "Sonatina in B-flat", composer: "G. F. Handel" },
    { id: "k28L80FWNSJ9", title: "Two Sonatinas, Anh. 5", composer: "Ludwig van Beethoven" },
    { id: "b8W3vrVR06Qo", title: "Minuet in F, K. 2", composer: "W. A. Mozart" },
    { id: "pzU8jLSS1NiJ", title: "Minuet in G, K. 1", composer: "W. A. Mozart" },
    { id: "dsHMfT7I5i1I", title: "Minuet in D, K. 94", composer: "W. A. Mozart" },
    { id: "NnDvYcpB6R21", title: "Nocturne in E-flat, H 56", composer: "John Field" },
    { id: "hqSbXf4vgnLA", title: "Nocturne in E minor, H 46", composer: "John Field" },
    { id: "qzVZUx1FcKyp", title: "Nocturne No. 6, Op. 63", composer: "Gabriel Fauré" },
    { id: "Aix9APzSrM7I", title: "Nocturne in A-flat, WoO 3", composer: "Alexander Scriabin" },
    { id: "Lp3pYHl18Ocf", title: "Waltz, Op. 51 No. 6", composer: "Pyotr Tchaikovsky" },
    { id: "fGOO8pHm0qaE", title: "Waltz No. 10", composer: "Johannes Brahms" },
    { id: "DpPqnXtsbCvC", title: "Twenty-four Waltzes, Op. 32", composer: "Carl Czerny" },
    { id: "kaV7eNLi899N", title: "Greensleeves", composer: "Traditional" },
    { id: "uzo6hVxZYnuI", title: "Amazing Grace", composer: "Traditional" },
    { id: "pwhwiOvdnR0K", title: "Danny Boy", composer: "Traditional" },
    { id: "yHR7cn9MEShM", title: "Moonlight Sonata, 1st movement", composer: "Ludwig van Beethoven" },
    { id: "rmn0H2s9YNOr", title: "Ode to Joy", composer: "Ludwig van Beethoven" },
    { id: "1fX1CRCi4I78", title: "Rondo alla Turca", composer: "W. A. Mozart" },
    { id: "nvJW4eCw0Hb1", title: "Sonata K. 545", composer: "W. A. Mozart" },
    { id: "zZrXItdurWQj", title: "Toccata and Fugue in D minor", composer: "J. S. Bach" },
    { id: "zhlYVshIrwg2", title: "Hungarian Dance No. 1", composer: "Johannes Brahms" },
    { id: "xrKmwOtUbwed", title: "Liebesträume No. 3", composer: "Franz Liszt" },
    { id: "Z7t8pm3QNpvP", title: "Revolutionary Étude", composer: "Frédéric Chopin" },
    { id: "0ru1GttHHBJt", title: "Marche funèbre", composer: "Frédéric Chopin" },
    { id: "THU1bEyNNzik", title: "Rêverie", composer: "Claude Debussy" },
    { id: "MFqla93pUrMC", title: "Maple Leaf Rag", composer: "Scott Joplin" },
    { id: "AsGmRll6tbOk", title: "Swan Lake", composer: "Pyotr Ilyich Tchaikovsky" },
    { id: "TgBO9jkf93jV", title: "Salut d'amour", composer: "Edward Elgar" },
    { id: "Yhwl81dNJj05", title: "Pavane pour une infante défunte", composer: "Maurice Ravel" },
];

// Everything a piece produces lives in one folder, under its composer: promo/erik-satie/
// gymnopedie-no-1/ holds the reel, the full-length cut and the thumbnail together. A post
// is assembled from one piece at a time, so the folder is the unit somebody actually
// works with — where three parallel directories meant matching a name across all of them
// and noticing when one was missing.
//
// Accents and punctuation go: "Gymnopédie No. 1" becomes gymnopedie-no-1. Two pieces can
// share a title — a Schubert Ave Maria and a Bach/Gounod one — but not under the same
// composer, so the composer segment settles what a flat name could not.
export function folderFor(piece) {
    return `${folderForComposer(piece.composer)}/${slug(piece.title)}`;
}

// The folder holding everything of one composer's — every piece of theirs, and the playlist
// text that collects them. Built from the same slug the piece paths are, so a playlist
// cannot land beside a different composer's clips than the one it names.
export function folderForComposer(composer) {
    return slug(composer);
}

// Two pieces landing on one path would have the second overwrite the first, and a folder
// short of a clip reads as a render that failed rather than a list that collides. Checked
// at import, because the list is edited by hand and there is no other moment that would
// catch it.
{
    const seen = new Set();
    for (const piece of PIECES) {
        const path = folderFor(piece);
        if (seen.has(path)) {
            throw new Error(`two pieces both want promo/${path} — give one a distinct title`);
        }
        seen.add(path);
    }
}

// Internal to the naming above: every path a piece owns is built here, so nothing
// outside needs to make one.
function slug(title) {
    return title
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
}
