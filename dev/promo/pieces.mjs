// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The pieces worth leading with: recognisable in three seconds, and CC0, so nothing is
// owed by a post that carries only the picture. Ids are content fingerprints, so a
// re-import that changes the notes changes the id and this list stops matching — which is
// the failure we want (a missing piece), not a silently different one.
//
// One list, read by the video renderer and by the thumbnail generator, so a clip and its
// thumbnail can never be of different pieces.

export const PIECES = [
    { id: "TOBNVaraGATl", title: "Gymnopédie No. 1", composer: "Erik Satie" },
    { id: "peJ0t6fhDKjp", title: "Gnossienne No. 1", composer: "Erik Satie" },
    { id: "VYBNsVqZzqa9", title: "Valses distinguées No. 2", composer: "Erik Satie" },
    { id: "yORzpFl5Dpfi", title: "Prelude in C, BWV 846", composer: "J. S. Bach" },
    { id: "GFdSJIBHjLm1", title: "Canon in D", composer: "Johann Pachelbel" },
    { id: "OlYvqHsXwB63", title: "Für Elise", composer: "Ludwig van Beethoven" },
    { id: "8EKlMBPOS5dj", title: "The Entertainer", composer: "Scott Joplin" },
    { id: "zCR5qNmpjcYD", title: "Solace", composer: "Scott Joplin" },
    { id: "3hknjVHy3gan", title: "Clair de lune", composer: "Claude Debussy" },
    { id: "8p8IBmci1d2l", title: "Première arabesque", composer: "Claude Debussy" },
    { id: "0nlCL3JvtjCl", title: "Nocturne in C-sharp minor", composer: "Frédéric Chopin" },
    { id: "gZKH4xnshzeG", title: "Fantaisie-impromptu, Op. 66", composer: "Frédéric Chopin" },
    { id: "GwgHLdwI1tJU", title: "Nocturnes, Op. 9", composer: "Frédéric Chopin" },
    { id: "9OmWzgIPdNFd", title: "Nocturnes, Op. 27", composer: "Frédéric Chopin" },
    { id: "y93KGmDQoD12", title: "Nocturne in E minor, Op. 72 No. 1", composer: "Frédéric Chopin" },
    { id: "wx8UhU1HozEL", title: "Waltzes, Op. 64", composer: "Frédéric Chopin" },
    { id: "8f3TJUVUEjfo", title: "Waltzes, Op. 69", composer: "Frédéric Chopin" },
    { id: "SvMHyl2yF7YS", title: "Waltz in A minor, B. 150", composer: "Frédéric Chopin" },
    { id: "YG1UemgwoxnB", title: "Wedding March", composer: "Felix Mendelssohn" },
    { id: "yxW1jGFJPEcF", title: "Anitra's Dance", composer: "Edvard Grieg" },
    { id: "GGAHdvH4ToTQ", title: "Peer Gynt, Op. 23", composer: "Edvard Grieg" },
    { id: "TaKfOgLMeIML", title: "L'arabesque", composer: "Friedrich Burgmüller" },
    { id: "mimKg0nWHBhC", title: "Rêverie", composer: "Augusta Holmès" },
    { id: "9lEEckSFDs5p", title: "Ave Maria", composer: "Franz Schubert" },
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
    { id: "DzNX5Qf8cKgs", title: "Fairy Lullaby", composer: "Amy Beach" },
    { id: "ARc0pONVwLU4", title: "Greensleeves", composer: "Traditional" },
    { id: "uzo6hVxZYnuI", title: "Amazing Grace", composer: "Traditional" },
    { id: "pwhwiOvdnR0K", title: "Danny Boy", composer: "Traditional" },
];

// A filename somebody can pick out of a folder: the piece, not its fingerprint. Accents
// and punctuation go — "Gymnopédie No. 1" becomes gymnopedie-no-1. Two pieces can share a
// title (a Schubert Ave Maria and a Bach/Gounod one), and a bare title slug would have the
// second silently overwrite the first, so a repeated title takes its composer along.
export function fileNameFor(piece) {
    const shares = PIECES.filter((other) => other.title === piece.title).length > 1;
    return shares ? `${slug(piece.title)}-${slug(piece.composer)}` : slug(piece.title);
}

export function slug(title) {
    return title
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
}
