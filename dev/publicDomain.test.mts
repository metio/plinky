// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { creditAllowed, isPublicDomain } from "./publicDomain.mts";

describe("isPublicDomain", () => {
    it("admits well-known public-domain composers", () => {
        for (const composer of [
            "Johann Sebastian Bach",
            "J.S. Bach",
            "Wolfgang Amadeus Mozart",
            "Frédéric Chopin",
            "Arthur Sullivan",
            "John Dowland",
            "Turlough O'Carolan",
            "Antonio Vivaldi",
        ]) {
            expect(isPublicDomain(composer), composer).toBe(true);
        }
    });

    it("admits composers whose surname is diacritic-folded or continues the stem", () => {
        // The composer field carries accents inconsistently, and Slavic surnames often
        // continue a stem — both must still match.
        expect(isPublicDomain("Georg Friedrich Händel")).toBe(true);
        expect(isPublicDomain("Gabriel Fauré")).toBe(true);
        expect(isPublicDomain("Antonín Dvořák")).toBe(true);
        expect(isPublicDomain("Pyotr Ilyich Tchaikovsky")).toBe(true);
        expect(isPublicDomain("Sergei Rachmaninoff")).toBe(true);
        expect(isPublicDomain("Modest Mussorgsky")).toBe(true);
    });

    it("admits the vetted public-domain composers whose surnames are on the allowlist", () => {
        // All died on or before the life+70 cutoff; surnames distinctive enough not to
        // collide with any copyrighted act in the corpus.
        for (const composer of [
            "Béla Bartók", // 1945
            "Gustav Mahler", // 1911
            "Kurt Weill", // 1950
            "Carlos Gardel", // 1935
            "George Butterworth", // 1916
            "Johan Halvorsen", // 1935
            "Rabindranath Tagore", // 1941
            "Manuel M. Ponce", // 1948
            "Francesco Paolo Tosti", // 1916
            "Calixa Lavallée", // 1891
        ]) {
            expect(isPublicDomain(composer), composer).toBe(true);
        }
    });

    it("refuses a familiar teaching-repertoire name whose copyright has not expired", () => {
        // The list is read by the importer as proof of public domain, so a name that
        // belongs on a beginner's shelf but not yet in the public domain must stay off it.
        expect(isPublicDomain("William Gillock", "Fountain in the Rain")).toBe(false); // 1993
        expect(isPublicDomain("A.Goedicke", "50 Simple piano Pieces, No. 46")).toBe(false); // 1957
        expect(isPublicDomain("Alexander Gedike")).toBe(false);
    });

    it("admits full-name public-domain composers whose bare surname is unsafe", () => {
        // Matched by full name so the common token never opens the door to a copyrighted
        // namesake (David Foster, b. 1949) or a too-common surname.
        expect(isPublicDomain("Stephen Foster")).toBe(true); // 1864
        expect(isPublicDomain("Adolphe Adam", "O Holy Night")).toBe(true); // 1856
        expect(isPublicDomain("David Foster", "The Prayer")).toBe(false);
    });

    it("admits a composer given a (birth–death) range on or before the cutoff", () => {
        expect(isPublicDomain("Carl Czerny (1791-1857)")).toBe(true);
        expect(isPublicDomain("Some Composer (1685–1750)")).toBe(true);
        // A death after the life+70 cutoff is not yet public domain.
        expect(isPublicDomain("Some Composer (1900-1980)")).toBe(false);
    });

    it("admits traditional / anonymous / folk works", () => {
        expect(isPublicDomain("Traditional", "Greensleeves")).toBe(true);
        expect(isPublicDomain("Anonymous")).toBe(true);
        expect(isPublicDomain("arr. Smith", "Traditional Irish Folk")).toBe(true);
    });

    it("rejects copyrighted acts wrongly tagged CC0 on PDMX", () => {
        for (const composer of [
            "Panic! At the Disco",
            "Billie Eilish",
            "Koji Kondo",
            "Toby Fox",
            "Hans Zimmer",
            "Burt Bacharach", // must not match the "bach" surname
            // Died 1957 — not life+70 public domain until 2028, so kept OFF the allowlist
            // despite being a canonical classical name.
            "Jean Sibelius",
            "Jean Sibelius (1865-1957)",
            // Copyrighted namesakes / co-writers a bare PD surname would wrongly admit,
            // which is why "gonzaga" and "waller" are kept off the allowlist.
            "Luiz Gonzaga", // d. 1989 — not the PD Chiquinha Gonzaga
            "Luiz Gonzaga e Humberto Teixeira", // "Asa Branca"
        ]) {
            expect(isPublicDomain(composer), composer).toBe(false);
        }
    });

    it("does not let a surname stem bleed into a title word", () => {
        // "bach" ⊄ "bachelor", "clementi" ⊄ "clementine": composer-name patterns read
        // the composer field only, and match complete surnames.
        expect(isPublicDomain("Panic! At the Disco", "Death of a Bachelor")).toBe(false);
        expect(isPublicDomain("Percy Montrose", "Oh My Darling Clementine")).toBe(false);
    });

    it("rejects an empty composer — no attribution to confirm", () => {
        expect(isPublicDomain("")).toBe(false);
        expect(isPublicDomain("   ")).toBe(false);
    });
});

describe("the copyrighted-works denylist beats the traditional label", () => {
    it("denies 20th-century works the corpora mislabel Traditional", () => {
        expect(isPublicDomain("Misc Traditional", "petit papa noel")).toBe(false);
        expect(isPublicDomain("Traditional", "you are my sunshine")).toBe(false);
        expect(isPublicDomain("Trad", "Tzena Tzena")).toBe(false);
    });

    it("keeps admitting genuinely traditional works", () => {
        expect(isPublicDomain("Traditional", "Greensleeves")).toBe(true);
    });
});

describe("a word in the title never admits a work on its own", () => {
    // The hole this closes, with the five works that came through it. A traditional
    // marker in the composer field says nobody claims the work; the same word in a title
    // says something about the music, and copyrighted music has words about music in its
    // name.
    it("refuses a copyrighted work whose title reads as traditional", () => {
        for (const [composer, title] of [
            ["Rolf Zuckowski", "In der weihnachtsbäckerei"],
            ["Composed by The Seatbelts", "The real folk blues"],
            ["Nate Piffer & Dallon Weekes", "Oh Noel"],
            ["Manaka Tominaga & Shiho Fujii & Kazumi Totaka", "Animal Crossing City Folk"],
            ["Misc Soundtrack", "Weihnachtsmann und co kg theme"],
        ] as const) {
            expect(isPublicDomain(composer, title), `${composer} — ${title}`).toBe(false);
        }
    });

    it("still admits an unattributed work its title names as traditional", () => {
        // The case the title rule exists for: nobody is claiming these, and the credit
        // says so. core/person.ts decides what counts as claiming nobody, which is the
        // same answer that stops "Traditional" getting a composer page.
        expect(isPublicDomain("from Lyra Davidica 1708", "Easter Hymn")).toBe(true);
        expect(isPublicDomain("Anonymous", "A carol")).toBe(true);
        expect(isPublicDomain("Traditional", "Anything at all")).toBe(true);
    });

    it("refuses a named living composer however traditional the title sounds", () => {
        expect(isPublicDomain("Someone Alive", "A folk hymn carol wiegenlied")).toBe(false);
    });
});

describe("music written for a screen", () => {
    it("is refused whichever field announces it", () => {
        // Modern by definition: there were no soundtracks before there were films. The
        // corpora label these with a composer placeholder that claims no author, which
        // every other rule here would read as anonymity.
        expect(isPublicDomain("Misc Soundtrack", "Anything")).toBe(false);
        expect(isPublicDomain("Traditional", "Cowboy Bebop OST")).toBe(false);
        expect(isPublicDomain("Traditional", "Some anime opening")).toBe(false);
        expect(isPublicDomain("Traditional", "A video game march")).toBe(false);
    });

    it("leaves a theme that is a musical form alone", () => {
        // "theme" is not a marker: a theme and variations is a form, not a film.
        expect(isPublicDomain("Wolfgang Amadeus Mozart", "Theme and Variations")).toBe(true);
    });
});

describe("composers admitted by name rather than by a word in their titles", () => {
    it("admits the ones whose hymns and lullabies used to carry them in", () => {
        for (const composer of [
            "Pelham Humfrey",
            "Thomas Ravenscroft",
            "Nicholas Brady",
            "Louise Reichardt",
            "Peter Cornelius",
            "Bernhard Flies",
            "Oliver Holden",
            "Jeremiah Ingalls",
            "Mykola Leontovych",
            "Johanna Kinkel",
            "Augusta Holmès",
            "Augusta Mary Anne Holmès",
            "Luise Adolpha Le Beau",
            "Joe Hill",
            "Clara Faisst",
            "Charles Hubert Hastings Parry",
            "Virginia Gabriel",
            "Sergei Lyapunov",
            "Josephine Lang",
            "Robert Franz",
        ]) {
            expect(isPublicDomain(composer, "Untitled"), composer).toBe(true);
        }
    });

    it("keeps the common surnames shut to everybody else who bears them", () => {
        // Each of these needs its full name, because the surname alone is an ordinary
        // modern one — and "flies" is an ordinary English word.
        for (const composer of [
            "Peter Gabriel",
            "David Hill",
            "Lang Lang",
            "Franz Ferdinand",
            "Tom Brady",
            "William Holden",
            "Cornelius",
            "Flies",
            "Parry Gripp",
        ]) {
            expect(isPublicDomain(composer, "Untitled"), composer).toBe(false);
        }
    });
});

describe("a credit that names a category rather than a person", () => {
    it("is refused however traditional the rest of it reads", () => {
        // "Misc Christmas", "Misc Traditional", "Misc Soundtrack" are the corpora's filing
        // buckets sitting in the field that should say who wrote the piece. It is neither
        // an attribution nor a claim of anonymity, and every rule that read it read it
        // wrongly: the soundtrack bucket passed as nobody-claims-it, and the Christmas one
        // carried two carols in on a word in their titles.
        for (const composer of ["Misc Christmas", "Misc Traditional", "Misc Soundtrack", "misc"]) {
            expect(isPublicDomain(composer, "Coventry carol"), composer).toBe(false);
        }
    });

    it("leaves a real name that merely begins the same way alone", () => {
        expect(isPublicDomain("Mischa Levitzki (1898-1941)", "Untitled")).toBe(true);
    });
});

describe("creditAllowed", () => {
    it("admits a public-domain credit and refuses a copyrighted artist in the same field", () => {
        expect(creditAllowed("Johann Sebastian Bach", "Prelude")).toBe(true);
        expect(creditAllowed("Traditional", "Greensleeves")).toBe(true);
        expect(creditAllowed("Ludovico Einaudi", "Nuvole Bianche")).toBe(false);
        expect(creditAllowed("", "Untitled")).toBe(false);
    });
});
