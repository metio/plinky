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
    chopinff: "Frédéric Chopin",
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
    "turlough carolan": "Turlough O'Carolan",
    "frédérick chopin": "Frédéric Chopin",
    "g. f. händel": "George Frideric Handel",
    "georg friedrich händel": "George Frideric Handel",
    haendel: "George Frideric Handel",
    händel: "George Frideric Handel",
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
    // ---- Found by walking every composer page in the shipped catalogue, 2026-08-25.
    // Each of these owned a page of its own — most of them one piece deep, sitting a few
    // rows from the composer they belong to in the same alphabetical directory.

    // Initials and short forms the mechanical cleanup cannot join to a full name.
    "j. s bach": "Johann Sebastian Bach",
    "joh. seb. bach": "Johann Sebastian Bach",
    "w a mozart": "Wolfgang Amadeus Mozart",
    "m. praetorius": "Michael Praetorius",
    "p. tchaikovsky": "Pyotr Ilyich Tchaikovsky",
    "s. rachmaninoff": "Sergei Rachmaninoff",
    "fr. chopin": "Frédéric Chopin",
    "e. grieg": "Edvard Grieg",
    "edvard h. grieg": "Edvard Grieg",
    "f. mendelssohn-bartholdy": "Felix Mendelssohn",
    "g f handel": "George Frideric Handel",

    // Surnames left bare, either by the corpus or by unwelding a source code
    // ("SchubertF" arrives here as "Schubert"). Each is unambiguous in this catalogue:
    // the bare "Purcell" carries Dido's Lament, which is Henry's.
    schubert: "Franz Schubert",
    debussy: "Claude Debussy",
    joplin: "Scott Joplin",
    satie: "Erik Satie",
    kumar: "Ramana Kumar",
    purcell: "Henry Purcell",
    offenbach: "Jacques Offenbach",
    rossini: "Gioachino Rossini",
    tosti: "Francesco Paolo Tosti",
    somervell: "Arthur Somervell",
    spagnoletti: "Paolo Spagnoletti",
    yaniewicz: "Feliks Janiewicz",
    pease: "Alfred Humphries Pease",
    pejacsevich: "Dora Pejačević",
    // The second J is "Junior": the corpus writes Johann Strauss II this way and gives
    // his father a code of his own, so this is one man rather than both.
    strauss: "Johann Strauss II",

    // Spellings of one person that differ by more than case.
    "giuseppi verdi": "Giuseppe Verdi",
    "modest moussorgsky": "Modest Mussorgsky",
    "peter ilyich tchaikovsky": "Pyotr Ilyich Tchaikovsky",
    "peter tchaikovsky": "Pyotr Ilyich Tchaikovsky",
    "jean phillipe rameau": "Jean-Philippe Rameau",
    "jean philippe rameau": "Jean-Philippe Rameau",
    "claude-achille debussy": "Claude Debussy",
    "frédéric françois chopin": "Frédéric Chopin",
    "frederic chopin": "Frédéric Chopin",
    "felix mendelssohn bartholdy": "Felix Mendelssohn",
    "turloch o'carolan": "Turlough O'Carolan",
    "handel george frideric": "George Frideric Handel",
    "georg friedrich handel": "George Frideric Handel",
    "georg-friedrich haendel": "George Frideric Handel",
    // Case alone, which the lowercase key already folds — listed so the canonical
    // spelling is the one that wins rather than whichever score loaded first.
    "ludwig van beethoven": "Ludwig van Beethoven",

    // Text the harvest welded onto a name: a title in front of it, a tempo marking behind
    // it, a lyricist after it. The piece is the same piece; the credit simply arrived
    // carrying its neighbours.
    "an die musik - schubert": "Franz Schubert",
    "turlough o'carolan andante con moto": "Turlough O'Carolan",
    // Thomas Moore wrote the words to a traditional Irish air, welded on with no label to
    // cut at — so unlike its neighbours this one cannot be reached mechanically. The music
    // is the traditional half, which is what a piano catalogue credits.
    "traditionalthomas moore": "Traditional",
    // A 1708 hymnal rather than a person: the Easter Hymn in it is anonymous.
    "from lyra davidica": "Traditional",

    // Characters that did not survive the corpus being read in the wrong encoding, and
    // one that did not survive being read at all. Nothing in the string says it is
    // broken, so only a table can reach them.
    "bedåich smetana": "Bedřich Smetana",
    "g. f. h?ndel": "George Frideric Handel",

    // Leopold Mozart, Wolfgang's father — a composer in his own right, and NOT the same
    // person. Spelled out precisely because the surname invites the wrong merge.
    "l. mozart": "Leopold Mozart",

    // ---- A second pass, from grouping every page by surname and reading what stood
    // beside what. These are pairs the walk of the directory did not turn up, because the
    // two spellings sort apart: "Amy Beach" and "Amy Marcy Beach" are nowhere near each
    // other alphabetically, and neither is obviously wrong on its own.
    "robert alexander schumann": "Robert Schumann",
    "franz joseph haydn": "Joseph Haydn",
    pachelbel: "Johann Pachelbel",
    "antonio lucio vivaldi": "Antonio Vivaldi",
    "henry walford davies": "Walford Davies",
    "alexander c. mackenzie": "Alexander Mackenzie",
    "m. clementi": "Muzio Clementi",
    "amy marcy beach": "Amy Beach",
    "s. coleridge-taylor": "Samuel Coleridge-Taylor",
    "aleksandr scriabin": "Alexander Scriabin",
    "h. t. burleigh": "Harry Thacker Burleigh",
    "sigismond thalberg": "Sigismund Thalberg",
    "james pierpont": "James Lord Pierpont",
    // Francisca Edwiges Neves Gonzaga, known and published as Chiquinha.
    "francisca gonzaga": "Chiquinha Gonzaga",
    "examples by rimsky-korsakov": "Nikolai Rimsky-Korsakov",
    // A dice game of doubtful attribution, catalogued under Mozart as K.516f; Simrock
    // published it and the harvest welded the publisher to the composer.
    "nikolaus simrockw. a. mozart": "Wolfgang Amadeus Mozart",
    // The keyboard transcription is Bach's, after Vivaldi's concerto, and it is Bach's
    // BWV number the piece is filed under.
    "vivaldi/bach": "Johann Sebastian Bach",
    // A capital the corpus dropped. Alessandro is Domenico's father and a different
    // composer, so this fixes the spelling without merging the two.
    "alessandro scarlatti": "Alessandro Scarlatti",

    // Initials whose owner the piece itself names: Köhler's Op. 93 is his flute method,
    // Carcassi's Op. 59 his guitar method, and Cavalleria rusticana is Mascagni's opera.
    // Popper's credit carries his dates. None of these needed looking up anywhere else.
    "d. popper": "David Popper",
    "e. kohler": "Ernesto Köhler",
    "m. carcassi": "Matteo Carcassi",
    "p. mascagni": "Pietro Mascagni",

    // The same again, from reading the directory rather than the code. Each one's own
    // piece names its owner: Bertini's Op. 29 is his 24 études, the Erato praeludium is
    // from Fischer's Musicalischer Parnassus (its suites are named for the muses), the
    // "six sonates faciles" are Dussek's, and the Flower Duet is from Lakmé.
    // Two the promo list writes differently from every corpus, so nothing else had taught
    // the table about them. Six other spellings of Tchaikovsky already merge; this is the
    // seventh. "Bach-Gounod" is left alone on purpose: the hyphen is the conventional way
    // to credit the Ave Maria to both of them, and splitting on hyphens would tear
    // Rimsky-Korsakov in half.
    gounod: "Charles Gounod",
    "pyotr tchaikovsky": "Pyotr Ilyich Tchaikovsky",
    delibes: "Léo Delibes",
    "h. bertini": "Henri Bertini",
    "j. k. f. fischer": "Johann Kaspar Ferdinand Fischer",
    "j. l. dussek": "Jan Ladislav Dussek",

    // ---- A third pass, from comparing every page against every other by surname, by
    // containment and by edit distance rather than by eye. These are the ones a person
    // scrolling an alphabetical directory cannot see: the two spellings sort far apart, and
    // each looks perfectly correct where it stands.

    // Surname first, with no comma to flip on — the corpus writes the Hungarian order, and
    // one of the three also lost its accents on the way in.
    "bartók béla": "Béla Bartók",
    "bela bartok": "Béla Bartók",
    "bach johann sebastian": "Johann Sebastian Bach",
    "elgar edward": "Edward Elgar",
    "rimsky-korsakov": "Nikolai Rimsky-Korsakov",
    "c. saint-saens": "Camille Saint-Saëns",

    // Not a person alias but a credit somebody typed a thought into. The harvested score
    // carries "Traditional I think", which is a note to self rather than an attribution —
    // and unlike the dated and catalogue-numbered credits around it, nothing else here
    // reduces it, so it reached the page verbatim. A hedge is not part of a credit.
    "traditional i think": "Traditional",
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
    let name = raw.replace(/\b\p{Lu}{4,}\b/gu, (word) => word[0] + word.slice(1).toLowerCase());
    // Corpora that passed their credits through an HTML pipeline leak entities into
    // the name — a page reading `Claribel&quot;` is the credit failing in public.
    name = name
        .replace(/&quot;/gi, '"')
        .replace(/&amp;/gi, "&")
        .replace(/&#39;|&apos;/gi, "'");
    // An aside is replaced by a space rather than deleted: a credit that writes the dates
    // mid-string ("Turlough O'Carolan (1670-1738)ANDANTE CON MOTO") otherwise has the words
    // either side of it welded into one, and the weld reads as a name nobody has.
    name = name.replace(/\s*\([^)]*\)\s*/g, " ");
    // An aside somebody never closed ("Georg Friedrich Handel (1685-1759"). The balanced
    // rule above cannot see it, so the dates reached the page as part of the name.
    name = name.replace(/\s*\([^)]*$/, "");
    // A bracketed aside ("[published as …]") is about the work or the pen name, not
    // the person, and would otherwise split one composer across two pages.
    name = name.replace(/\s*\[[^\]]*\]/g, "");
    // When a credit was written, not by whom: "…, first published 1855", "…, words 18th c."
    // That is provenance about the WORK, and it trails the tradition it belongs to. The
    // date rule below takes the year and would leave ", first published" hanging on the end
    // of the name, so the clause goes whole.
    name = name.replace(/,\s*[^,]*(\b\d{4}\b|\d{1,2}(st|nd|rd|th)\s*c\b)[^,]*$/i, "");

    // A work number appended to the credit ("… Opus 100.", "Op.11.No.1") names the
    // piece, not its composer — so it and everything after it goes. But only when a
    // name survives in front of it: some corpora write the work number FIRST
    // ("Op 39, No. 15 Johannes Brahms"), and stripping to the end there would delete
    // the composer entirely and leave the piece credited to nobody.
    // Leading work numbers first, as many as are stacked up ("Op 39, No. 15 Brahms"),
    // each dropped on its own so the name behind them survives.
    // What the person DID, written in front of what they are called: "Music: Grattan
    // Flood", "Composed by …", "Worte & Musik: …", "by Scott Joplin". The label is about
    // the credit, not the human, and each spelling of it was splitting one composer off
    // into a page of their own.
    name = name.replace(
        /^[\s,.]*(worte\s*&\s*musik|music|musik|musique|tune|melody|air|composed\s+by|original\s+song\s+by|words\s+and\s+music\s+by|examples\s+by|arranged\s+by|by)\b\s*:?\s*/i,
        "",
    );
    // Who wrote the WORDS, and everything after them. A song credit routinely names both
    // halves — "Tune: Trad ScotlandWords: Robert Burns" — and a piano catalogue credits
    // the music: the lyricist wrote no notes. No word boundary in front, because the
    // harvest welds the second label straight onto the end of the first half.
    name = name.replace(/(words|lyrics|text|worte|poem|poetry|dichtung)\s*:.*$/i, "");
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
    // Who arranged it, which is not who wrote it. The parenthesised form is already
    // handled; this is the one that arrives welded to the name because the dates between
    // them were stripped — "Gioachino Rossini (1792-1868)arr. E Muirhead".
    name = name.replace(
        /\s*\b(arr|arrs|arranged|arrangement|transcr|transcribed|ed)\b\.?\s+(by\s+)?.*$/i,
        "",
    );

    // "Bach, Johann Sebastian" reads as a surname first and is flipped back. A comma in
    // PROSE is not that, and flipping one scrambles the credit into broken English:
    // "Traditional — English ballad, first registered 1580" came out as "first registered
    // Traditional — English ballad" and reached the piece page saying exactly that.
    //
    // So both halves have to look like parts of a name: one comma, at most three words
    // either side, and no dash or digit — an enriched attribution carries all three.
    const comma = name.indexOf(",");
    if (comma > 0 && comma < name.length - 1 && name.indexOf(",", comma + 1) === -1) {
        const before = name.slice(0, comma).trim();
        const after = name.slice(comma + 1).trim();
        const namelike = (part: string) =>
            part.length > 0 && part.split(/\s+/).length <= 3 && !/[\d—–-]/.test(part);
        if (namelike(before) && namelike(after)) {
            name = `${after} ${before}`;
        }
    }
    // One corpus writes its credits as a surname with the initials welded on the end —
    // "SchubertF", "BachJS", "BeethovenLv", "PejacsevichD". Each one owned a page of its
    // own, one piece deep, sitting a few rows from the composer it belongs to.
    //
    // The initials go rather than the surname: a bare surname is what the alias table
    // already knows how to finish, so "SchubertF" becomes "Schubert" and then Franz
    // Schubert. Only a single word ending in capitals matches, which is what makes it
    // safe — "McDonald" and "DeVries" carry lowercase after their inner capital and are
    // left alone.
    // The initials may themselves be capitalised pairs — "BeethovenLv" is L. v. Beethoven
    // — so each is an upper case optionally carrying one lower. The surname in front must
    // run to three characters or more, which is what keeps real names out: "McDonald" and
    // "MacKay" have too little before the break and too much after it.
    name = name.replace(/^(\p{Lu}\p{Ll}{2,})(?:\p{Lu}\p{Ll}?){1,3}$/u, "$1");
    // A trailing full stop is punctuation from the credit line, never part of a name.
    return name
        .replace(/\s+/g, " ")
        .replace(/[.,;:]+$/, "")
        .trim();
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
// A key, not a name. One credit reads "E Minor / Traditional", where the first half names
// the key the piece is in — split off from the tradition beside it, it would otherwise open
// a composer page for E Minor.
const A_KEY = /^[a-g][\u266f\u266d#b]?\s*(major|minor|dur|moll)$/i;

const NOT_A_PERSON =
    /\b(trad|traditional|traditionnelle?|tradicional|anonymous|anonymus|anonyme|anonimo|anónimo|anon|volkslied|gregorian[ao]?|gregoriana|plainchant|folk(\s?song|\s?tune)?|spiritual|shanty|misc|hymn\s?tune)\b/i;

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
    // The first person a credit names, which for the overwhelming majority of them is the
    // only one. Callers that have to account for every name use personSlugs.
    return personSlugs(raw)[0] ?? "";
}

// Credits that join two people with a hyphen, listed by hand because no rule can tell them
// from a hyphenated surname: Rimsky-Korsakov, Saint-Saëns and Mendelssohn-Bartholdy are one
// person each, and nothing in the shape of the string says which kind it is.
//
// Both entries are the same piece of music history — a setting so much its arranger's that
// the credit kept them both. Gounod wrote his melody over Bach's first prelude; Dietsch
// built his Ave Maria out of an Arcadelt chanson in 1842 and presented it as an Arcadelt
// discovery. Keyed by the cleaned credit, lowercased.
const JOINT_CREDITS: Record<string, string[]> = {
    "bach-gounod": ["Johann Sebastian Bach", "Charles Gounod"],
    "arcadelt-dietsch": ["Jacques Arcadelt", "Pierre-Louis Dietsch"],
};

// Every person a credit names, as slugs, in the order written.
//
// A credit is usually one person, and sometimes several: a chorale melody by Gesius that
// Telemann set, Bach's transcription of a Marcello concerto, two Hills who wrote Happy
// Birthday between them. Joined into one string they used to make one composite "person",
// so /person/bartholomaus-gesius-georg-philipp-telemann existed as a page for a composer
// who never did, and neither of the two real ones was credited with the piece at all.
//
// The split runs on the CLEANED name and not the raw credit, which is what makes it safe:
// "Poldowski (the professional pseudonym of the ... composer and pianist ...)", "Worte &
// Musik: Siegfried Köhler" and "Jane Mary Guest [aka Jenny Guest; ...]" all carry a
// separator inside a part that cleaning removes first, and each is one person.
export function personSlugs(raw: string): string[] {
    const slugs: string[] = [];
    for (const name of canonicalPeople(raw)) {
        const slug = slugOf(name);
        if (slug && !slugs.includes(slug)) {
            slugs.push(slug);
        }
    }
    return slugs;
}

// The canonical name of every person a credit names. Each part is canonicalised in its own
// right, so "Bach / Marcello" gives Johann Sebastian Bach rather than a "Bach" who sorts
// away from himself.
export function canonicalPeople(raw: string): string[] {
    const cleaned = canonicalComposer(raw);
    const joint = JOINT_CREDITS[cleaned.toLowerCase()];
    if (joint) {
        return joint;
    }
    const parts = cleaned.split(/\s+\/\s+|\s+&\s+|\s+\band\b\s+/i);
    return parts.length === 1
        ? [cleaned]
        : parts.map((part) => canonicalComposer(part.trim())).filter((part) => part !== "");
}

// The slug a single, already-canonical name gets, or "" when it names no person.
function slugOf(name: string): string {
    if (NOT_A_PERSON.test(name) || cannotBeAPerson(name) || A_KEY.test(name.trim())) {
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
        // A piece credited to several people belongs on each of their pages, rather than on
        // one page for a composite of them that no one is.
        const names = canonicalPeople(piece.composer);
        for (const name of names) {
            const slug = personSlug(name);
            if (!slug) {
                continue;
            }
            const person = bySlug.get(slug) ?? { slug, name, pieces: [] };
            person.pieces.push(piece);
            bySlug.set(slug, person);
        }
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
    const slugs = new Map<string, string[]>();
    const mine = pieces.filter((piece) => {
        let seen = slugs.get(piece.composer);
        if (seen === undefined) {
            // Every person the credit names, so a piece two composers share is found from
            // either of their pages.
            seen = personSlugs(piece.composer);
            slugs.set(piece.composer, seen);
        }
        return seen.includes(slug);
    });
    return mine.length > 0 ? (peopleFrom(mine)[0] ?? null) : null;
}
