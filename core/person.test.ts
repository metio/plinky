// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import {
    canonicalComposer,
    composerCounts,
    nameFromSlug,
    peopleFrom,
    personFor,
    personSlug,
    personSlugs,
} from "./person";

// Spellings lifted verbatim from the shipped manifest — the whole point of the
// canonicalization is that these real variants land on one name.
const BACH_VARIANTS = [
    "Johann Sebastian Bach",
    "Johann Sebastian BACH",
    "Johann Sebastian Bach(1685 - 1750)",
    "Johann Sebastian Bach (1685 - 1750)",
    "Johann Sebastian Bach(16851750)",
    "J. S. Bach",
    "J.S. Bach",
    "J. S. Bach(1685-1750)",
];

describe("canonicalComposer", () => {
    it("lands every real-world Bach variant on the one name", () => {
        for (const variant of BACH_VARIANTS) {
            expect(canonicalComposer(variant)).toBe("Johann Sebastian Bach");
        }
    });

    it("folds a misspelled credit onto the composer it meant", () => {
        // Each of these is one score in the catalogue, spelled a letter away from a
        // composer with dozens. Nothing in the string says it is wrong, so only the table
        // can merge them — and unmerged, each owned a page holding a single piece that
        // could not be reached from the real composer's.
        expect(canonicalComposer("CRAUDE DEBUSSY")).toBe("Claude Debussy");
        expect(canonicalComposer("Calude Debussy")).toBe("Claude Debussy");
        expect(canonicalComposer("Wolfgang Amedeus Mozart")).toBe("Wolfgang Amadeus Mozart");
        expect(canonicalComposer("Eric Satie")).toBe("Erik Satie");
        expect(canonicalComposer("George Frederic Handel")).toBe("George Frideric Handel");
        expect(canonicalComposer("Sergeï Rachmaninov")).toBe("Sergei Rachmaninoff");
        // Cleaned of its work number first, then folded.
        expect(canonicalComposer("Edward Grieg Op. 54 No.3")).toBe("Edvard Grieg");
        // A catalogue number the work-number stripping does not recognise.
        expect(canonicalComposer("Maurice Ravel M. 19")).toBe("Maurice Ravel");
    });

    it("gives a folded misspelling the same page as the name it folds to", () => {
        expect(personSlug("CRAUDE DEBUSSY")).toBe(personSlug("Claude Debussy"));
        expect(personSlug("Eric Satie")).toBe(personSlug("Erik Satie"));
    });

    it("strips parenthesized asides and bare trailing dates", () => {
        expect(canonicalComposer("Erik Satie (1866 1925)")).toBe("Erik Satie");
        expect(canonicalComposer("Giuseppe Verdi (1813-1901)")).toBe("Giuseppe Verdi");
        expect(canonicalComposer("Maurice Ravel(1875-1937)")).toBe("Maurice Ravel");
        expect(
            canonicalComposer("Johanna Kinkel (originally published under the name J. Mathieux)"),
        ).toBe("Johanna Kinkel");
    });

    it("flips Last, First", () => {
        expect(canonicalComposer("Bach, Johann Sebastian")).toBe("Johann Sebastian Bach");
    });

    it("merges the traditional and anonymous markers", () => {
        for (const variant of ["Trad.", "trad.", "Traditional", "TRADITIONAL", "Traditionnel"]) {
            expect(canonicalComposer(variant)).toBe("Traditional");
        }
        expect(canonicalComposer("anonymus")).toBe("Anonymous");
    });

    it("keeps an unknown name as its cleaned self and empty as empty", () => {
        expect(canonicalComposer("Josephine Lang")).toBe("Josephine Lang");
        expect(canonicalComposer("")).toBe("");
    });
});

describe("personSlug", () => {
    it("is stable across variants and strips diacritics", () => {
        expect(personSlug("J.S. Bach")).toBe("johann-sebastian-bach");
        expect(personSlug("Frédéric Chopin")).toBe("frederic-chopin");
        expect(personSlug("Antonín Dvořák")).toBe("antonin-dvorak");
        expect(personSlug("Turlough O'Carolan (1670-1738)")).toBe("turlough-o-carolan");
    });

    it("is empty for an unusable composer", () => {
        expect(personSlug("")).toBe("");
        expect(personSlug("  ")).toBe("");
    });

    it("refuses to make a person out of an attribution marker", () => {
        // "Traditional" and "Anonymous" normalize for display but are not
        // people: no slug, so no link and no page.
        for (const marker of [
            "Trad.",
            "Traditional",
            "traditionnel",
            "anonymus",
            "Anon.",
            "Traditional — “Ah ! vous dirai-je, maman” (France, 1761)",
            "Irish Traditional music",
        ]) {
            expect(personSlug(marker)).toBe("");
        }
        // A person whose name merely contains the letters stays a person.
        expect(personSlug("Conrad Anonsen")).toBe("conrad-anonsen");
    });
});

describe("peopleFrom / personFor", () => {
    const pieces = [
        { id: "1", title: "Menuet", composer: "J. S. Bach", grade: 2 },
        { id: "2", title: "Air", composer: "Johann Sebastian Bach (1685 - 1750)", grade: 1 },
        { id: "3", title: "Gymnopédie", composer: "Erik Satie (1866-1925)", grade: 3 },
        { id: "4", title: "Untitled", composer: "" },
    ];

    it("groups variants under one person, most pieces first", () => {
        const people = peopleFrom(pieces);
        expect(people.map((person) => person.slug)).toEqual([
            "johann-sebastian-bach",
            "erik-satie",
        ]);
        expect(people[0]?.name).toBe("Johann Sebastian Bach");
        expect(people[0]?.pieces.map((piece) => piece.id)).toEqual(["2", "1"]);
    });

    it("drops pieces without a composer instead of inventing a page", () => {
        expect(peopleFrom(pieces).flatMap((person) => person.pieces)).toHaveLength(3);
    });

    it("finds one person by slug, or null", () => {
        expect(personFor(pieces, "erik-satie")?.pieces).toHaveLength(1);
        expect(personFor(pieces, "nobody-here")).toBeNull();
    });
});

describe("credits the catalogue actually carries", () => {
    it("merges the abbreviated spellings onto one person", () => {
        for (const [variant, canonical] of [
            ["C. Czerny", "Carl Czerny"],
            ["CzernyC", "Carl Czerny"],
            ["A. Scriabin", "Alexander Scriabin"],
            ["J. Brahms", "Johannes Brahms"],
            ["L. van Beethoven", "Ludwig van Beethoven"],
            ["M.Ravel", "Maurice Ravel"],
            ["Georg Friedrich Händel", "George Frideric Handel"],
            ["Felix Mendelssohn-Bartholdy", "Felix Mendelssohn"],
            ["António Vivaldi", "Antonio Vivaldi"],
            ["Frédérick Chopin", "Frédéric Chopin"],
        ] as const) {
            expect(canonicalComposer(variant)).toBe(canonical);
            expect(personSlug(variant)).toBe(personSlug(canonical));
        }
    });

    it("drops a work number that was filed as part of the composer's name", () => {
        expect(canonicalComposer("A.Scriabin Op.11.No.1")).toBe("Alexander Scriabin");
        expect(canonicalComposer("Johann Friedrich Franz Burgmüller Opus 100.")).toBe(
            "Johann Friedrich Franz Burgmüller",
        );
    });

    it("decodes an entity a credit picked up from an HTML pipeline", () => {
        expect(
            canonicalComposer("Charlotte Alington Barnard [published as &quot;Claribel&quot;]"),
        ).toBe("Charlotte Alington Barnard");
    });

    it("gives a tradition no page of its own", () => {
        for (const credit of ["Gregorian chant", "Volkslied", "1860s English Sea Shanty"]) {
            expect(personSlug(credit)).toBe("");
        }
    });

    it("strips the full stop a credit line left behind", () => {
        expect(canonicalComposer("John Philip Sousa.")).toBe("John Philip Sousa");
    });
});

describe("credits whose work number comes first", () => {
    it("keeps the composer instead of deleting them", () => {
        // Stripping "Op … " to the end of the string erased the whole credit when the
        // work number led it, leaving three real pieces attributed to nobody.
        expect(canonicalComposer("Op 39, No. 15 Johannes Brahms")).toBe("Johannes Brahms");
        expect(canonicalComposer("No.1. F. Chopin. Op.6")).toBe("Frédéric Chopin");
        // Survives as the full name: "M. Clementi" is Muzio, joined to his own page.
        expect(canonicalComposer("Opus 36 No. 1 M. Clementi")).toBe("Muzio Clementi");
    });

    it("still drops a work number that trails the name", () => {
        expect(canonicalComposer("Johann Friedrich Franz Burgmüller Opus 100.")).toBe(
            "Johann Friedrich Franz Burgmüller",
        );
    });

    it("leaves a name with no work number in it untouched", () => {
        for (const name of ["Johann Sebastian Bach", "Kurt Weill", "Turlough O'Carolan"]) {
            expect(canonicalComposer(name)).toBe(name);
        }
    });
});

describe("an arrangement's aside is not a claim about who wrote it", () => {
    it("keeps the arranger's page when the aside names a tradition", () => {
        // The tradition filter used to run on the raw credit, so this piece — BY
        // Burleigh — was handed to nobody by the word "Spiritual" inside his aside.
        const credit = "Harry Thacker Burleigh (arranged from a traditional Negro Spiritual)";
        expect(canonicalComposer(credit)).toBe("Harry Thacker Burleigh");
        expect(personSlug(credit)).toBe(personSlug("Harry Thacker Burleigh"));
    });

    it("still gives a tradition no page of its own", () => {
        for (const credit of ["Gregorian chant", "Volkslied", "Traditional", "Anonymous"]) {
            expect(personSlug(credit)).toBe("");
        }
    });
});

describe("nameFromSlug", () => {
    it("reads a slug back as words, for a composer the catalogue credits nobody by", () => {
        expect(nameFromSlug("clara-schumann")).toBe("Clara Schumann");
        expect(nameFromSlug("bach")).toBe("Bach");
    });

    it("survives the shapes a hand-typed URL arrives in", () => {
        expect(nameFromSlug("")).toBe("");
        expect(nameFromSlug("-")).toBe("");
        expect(nameFromSlug("--erik--satie--")).toBe("Erik Satie");
    });

    it("round-trips a slug this very module made, up to the diacritics it dropped", () => {
        // personSlug strips accents and case, so the name cannot come back whole. What
        // must come back is the word boundaries: a page title of "Faure" is a spelling a
        // reader forgives, "faure" is not.
        expect(nameFromSlug(personSlug("Gabriel Faur\u00e9"))).toBe("Gabriel Faure");
    });
});

describe("credits that are notes to self", () => {
    it("drops a hedge from a tradition marker", () => {
        // One harvested score credits "Traditional I think" — a thought somebody typed into
        // the composer field. Unlike the dated and catalogue-numbered credits around it,
        // nothing reduced it, so it reached the piece's page verbatim.
        expect(canonicalComposer("Traditional I think")).toBe("Traditional");
        expect(personSlug("Traditional I think")).toBe("");
    });

    it("leaves a genuinely enriched attribution alone", () => {
        // "Traditional — Irish" says something true about the piece. Only the hedge goes.
        expect(canonicalComposer("Traditional — Irish, 1761")).toBe("Traditional — Irish");
    });
});

describe("credits welded to their neighbours", () => {
    it("splits a name from an aside that had no space around it", () => {
        // The dates sit mid-string and the strip used to delete them without leaving a gap,
        // welding the words either side into a name nobody has.
        expect(canonicalComposer("Turlough O'Carolan (1670-1738)ANDANTE CON MOTO")).toBe(
            "Turlough O'Carolan",
        );
    });

    it("drops an aside its writer never closed", () => {
        // The balanced rule cannot see this one, so the life dates reached the page as part
        // of the composer's name.
        expect(canonicalComposer("Georg Friedrich Handel (1685-1759")).toBe(
            "George Frideric Handel",
        );
    });

    it("keeps the composer when the credit names the lyricist too", () => {
        // A song credit names both halves and a piano catalogue credits the music: the
        // lyricist wrote no notes. The second label arrives welded to the first half.
        // Both reduce to the tradition that wrote the tune, which owns no page.
        expect(canonicalComposer("Tune: Trad ScotlandWords: Robert Burns")).toBe("Trad Scotland");
        expect(personSlug(canonicalComposer("Tune: Trad ScotlandWords: Robert Burns"))).toBe("");
        expect(canonicalComposer("TraditionalThomas Moore")).toBe("Traditional");
    });

    it("drops a label saying what the person did", () => {
        expect(canonicalComposer("Music: Grattan Flood (1859-1928)")).toBe("Grattan Flood");
        expect(canonicalComposer("Composed by The Seatbelts")).toBe("The Seatbelts");
        expect(canonicalComposer("Original song by Giacomo Puccini")).toBe("Giacomo Puccini");
        expect(canonicalComposer("Worte & Musik: Siegfried Köhler (1946)")).toBe(
            "Siegfried Köhler",
        );
    });
});

describe("surnames with the initials welded on", () => {
    it("unwelds a source code into the composer it stands for", () => {
        // One corpus writes its credits this way, and each one owned a page of its own a
        // few rows from the composer it belongs to.
        expect(canonicalComposer("SchubertF")).toBe("Franz Schubert");
        expect(canonicalComposer("BachJS")).toBe("Johann Sebastian Bach");
        expect(canonicalComposer("DebussyC")).toBe("Claude Debussy");
        expect(canonicalComposer("PejacsevichD")).toBe("Dora Pejačević");
    });

    it("reads initials that carry a lower case letter of their own", () => {
        // "Lv" is L. v. — Ludwig van.
        expect(canonicalComposer("BeethovenLv")).toBe("Ludwig van Beethoven");
    });

    it("leaves real names that merely have a capital inside them", () => {
        // The surname in front must run to three characters and the tail must be initials,
        // which is what keeps these out.
        expect(canonicalComposer("McDonald")).toBe("McDonald");
        expect(canonicalComposer("MacKay")).toBe("MacKay");
        expect(canonicalComposer("DeVries")).toBe("DeVries");
    });
});

describe("one person, one page", () => {
    it("joins the spellings a harvest produced for the same composer", () => {
        // Each of these owned a page until it was merged. Handel alone had six.
        const handel = [
            "Handel George Frideric",
            "G F Handel",
            "Georg-Friedrich HAENDEL (1685 1759)",
            "Georg Friedrich Handel (1685-1759",
        ].map(canonicalComposer);
        expect(new Set(handel)).toEqual(new Set(["George Frideric Handel"]));

        // Surname first with no comma to flip on, and the same name with its accents lost.
        const bartok = ["Bartók Béla", "Bela Bartok", "Béla Bartók"].map(canonicalComposer);
        expect(new Set(bartok)).toEqual(new Set(["Béla Bartók"]));
    });

    it("keeps apart the people who merely share a surname", () => {
        // Leopold is Wolfgang's father and a composer in his own right; the surname invites
        // exactly the wrong merge. Philp and Phillips are two Victorian composers with
        // different dates and different countries.
        expect(canonicalComposer("L. Mozart")).toBe("Leopold Mozart");
        expect(canonicalComposer("W. A. Mozart")).toBe("Wolfgang Amadeus Mozart");
        expect(canonicalComposer("Elizabeth Philp")).toBe("Elizabeth Philp");
        expect(canonicalComposer("Elizabeth Phillips")).toBe("Elizabeth Phillips");
        // Alessandro is Domenico's father: the capital is fixed, the person is not merged.
        expect(canonicalComposer("Alessandro scarlatti")).toBe("Alessandro Scarlatti");
        expect(canonicalComposer("Domenico Scarlatti")).toBe("Domenico Scarlatti");
    });
});

describe("credits that name a tradition rather than a person", () => {
    it("recognises the markers in the languages the corpora use", () => {
        for (const credit of [
            "Chanson traditionnelle",
            "Melodía gregoriana",
            "Anonyme (Pijin english)",
            "Misc Christmas",
            "Russian Folk",
            "Old Swedish folk tune",
        ]) {
            expect(personSlug(canonicalComposer(credit))).toBe("");
        }
    });
});

describe("a credit that names more than one person", () => {
    it("gives each of them the piece, rather than one page for the pair", () => {
        // A chorale melody by Gesius that Telemann set is one piece and two composers.
        // Joined, they made /person/bartholomaus-gesius-georg-philipp-telemann — a page for
        // a composer who never existed, while neither real one was credited at all.
        expect(personSlugs("Bartholomäus Gesius / Georg Philipp Telemann")).toEqual([
            "bartholomaus-gesius",
            "georg-philipp-telemann",
        ]);
        expect(personSlugs("Mildred J. Hill & Patty S. Hill")).toEqual([
            "mildred-j-hill",
            "patty-s-hill",
        ]);
        expect(personSlugs("Scott Joplin and Scott Hayden")).toEqual([
            "scott-joplin",
            "scott-hayden",
        ]);
    });

    it("canonicalises each name in its own right", () => {
        // "Bach" alone would sort away from himself; each part goes through the same
        // aliasing a lone credit does — which is why the bare surname on the other side of
        // the slash lands on Alessandro Marcello, whose concerto this transcription is of.
        expect(personSlugs("Bach / Marcello")).toEqual([
            "johann-sebastian-bach",
            "alessandro-marcello",
        ]);
    });

    it("leaves alone the credits that only look like two people", () => {
        // Each of these carries a separator inside something the cleaning strips first, so
        // splitting the RAW credit would tear one person in half.
        expect(personSlugs("Worte & Musik: Siegfried Köhler (1946)")).toEqual(["siegfried-kohler"]);
        expect(personSlugs("Jane Mary Guest [aka Jenny Guest; Jane Mary Miles]")).toEqual([
            "jane-mary-guest",
        ]);
        expect(
            personSlugs(
                "Poldowski (the professional pseudonym of the Belgian-born British composer and pianist born Régine Wieniawski)",
            ),
        ).toEqual(["poldowski"]);
    });

    it("splits the two hyphenated joint credits, by hand", () => {
        // A hyphen cannot be split by rule — Rimsky-Korsakov and Saint-Saëns are one person
        // each — so these two are listed. Both are a setting so much its arranger's that the
        // credit kept both names: Gounod's melody over Bach's prelude, and Dietsch's 1842
        // Ave Maria built from an Arcadelt chanson.
        expect(personSlugs("Bach-Gounod")).toEqual(["johann-sebastian-bach", "charles-gounod"]);
        expect(personSlugs("Arcadelt-Dietsch")).toEqual([
            "jacques-arcadelt",
            "pierre-louis-dietsch",
        ]);
    });

    it("leaves a hyphenated surname whole", () => {
        expect(personSlugs("Rimsky-Korsakov")).toEqual(["nikolai-rimsky-korsakov"]);
        expect(personSlugs("Camille Saint-Saëns")).toEqual(["camille-saint-saens"]);
    });

    it("drops the halves that name no person", () => {
        // "E Minor / Traditional" names a key and a tradition. Neither is somebody, and the
        // key half would otherwise open a composer page for E Minor.
        expect(personSlugs("E Minor / Traditional")).toEqual([]);
    });

    it("still answers one slug for the ordinary credit", () => {
        expect(personSlug("Frédéric Chopin")).toBe("frederic-chopin");
        expect(personSlugs("Frédéric Chopin")).toEqual(["frederic-chopin"]);
        expect(personSlug("Traditional")).toBe("");
    });

    it("puts a shared piece on both composers' pages", () => {
        const pieces = [
            {
                id: "a",
                title: "Befiehl du deine Wege",
                composer: "Bartholomäus Gesius / Georg Philipp Telemann",
                grade: 3,
            },
            { id: "b", title: "Fantasia TWV 33", composer: "Georg Philipp Telemann", grade: 2 },
        ];
        expect(personFor(pieces, "bartholomaus-gesius")?.pieces.map((p) => p.id)).toEqual(["a"]);
        expect(personFor(pieces, "georg-philipp-telemann")?.pieces.map((p) => p.id)).toEqual([
            "b",
            "a",
        ]);
    });
});

describe("one composer under every spelling the catalogue holds", () => {
    it("merges the Burgmüller variants, bare surname and un-umlauted alike", () => {
        // Five spellings across the two manifests, which made three composer pages: one
        // with twenty-three pieces and two with one each. His brother Norbert was a
        // composer too, so a bare surname is ambiguous in principle — not here, since
        // both strays sit on Op. 100 and Op. 109.
        const canonical = "Johann Friedrich Franz Burgmüller";
        for (const variant of [
            "Johann Friedrich Franz Burgmüller",
            "Friedrich Burgmüller",
            "Johann Friedrich Franz Burgmüller Opus 100.",
            "Burgmüller",
            "Johann Friedrich Burgmuller",
        ]) {
            expect(canonicalComposer(variant)).toBe(canonical);
            expect(personSlug(variant)).toBe(personSlug(canonical));
        }
    });
});

describe("counting the composers a shelf holds", () => {
    it("gives each person in a shared credit the piece", () => {
        // The directory read one name per credit while the pages read every name, so a
        // piece two people wrote made a row for a composer nobody is — "Gesius /
        // Telemann", linked to whichever of them came first — and left the other short.
        const counts = composerCounts([
            { composer: "Bartholomäus Gesius / Georg Philipp Telemann" },
            { composer: "Georg Philipp Telemann" },
        ]);

        expect(counts.map((one) => one.slug).sort()).toEqual([
            "bartholomaus-gesius",
            "georg-philipp-telemann",
        ]);
        expect(counts.find((one) => one.slug === "georg-philipp-telemann")?.pieces).toBe(2);
        expect(counts.find((one) => one.slug === "bartholomaus-gesius")?.pieces).toBe(1);
        expect(counts.some((one) => one.name.includes("/"))).toBe(false);
    });

    it("agrees with the person pages about who holds what", () => {
        // The two answers are built by different functions over the same credits; a
        // reader who follows a directory row to a page must find the count it promised.
        const pieces = [
            { id: "a", title: "A", composer: "Bartholomäus Gesius / Georg Philipp Telemann" },
            { id: "b", title: "B", composer: "Georg Philipp Telemann" },
            { id: "c", title: "C", composer: "Mildred J. Hill & Patty S. Hill" },
        ];
        for (const count of composerCounts(pieces)) {
            expect(personFor(pieces, count.slug)?.pieces.length).toBe(count.pieces);
        }
    });

    it("counts a credit naming nobody towards nobody", () => {
        expect(composerCounts([{ composer: "Traditional" }, { composer: "" }])).toEqual([]);
    });

    it("counts one person once however many names the credit repeats", () => {
        // Two spellings the alias table folds together are one person, and the piece is
        // one piece. Counting per name rather than per person credited it twice.
        const counts = composerCounts([{ composer: "J. S. Bach / Johann Sebastian Bach" }]);

        expect(counts).toHaveLength(1);
        expect(counts[0]?.pieces).toBe(1);
    });

    it("lists a piece once on a page even when the credit names its composer twice", () => {
        const pieces = [{ id: "a", title: "A", composer: "J. S. Bach / Johann Sebastian Bach" }];

        expect(personFor(pieces, "johann-sebastian-bach")?.pieces).toHaveLength(1);
    });
});

describe("life dates welded to a name", () => {
    // A corpus writes a composer's dates half a dozen ways, and the ones without brackets
    // are the ones that used to survive canonicalization: the rule took the closing year
    // and left everything before it, so one man ended up on two shelves.
    it("strips a circa range that carries no brackets", () => {
        expect(canonicalComposer("Jean-Baptiste Duvernoy c. 1802 c. 1880")).toBe(
            "Jean-Baptiste Duvernoy",
        );
    });

    it("strips the bracketed circa range too", () => {
        expect(canonicalComposer("Jean-Baptiste Duvernoy (c.1802-c.1880)")).toBe(
            "Jean-Baptiste Duvernoy",
        );
    });

    it("puts every spelling of one man on one shelf", () => {
        const spellings = [
            "J.B.Duvernoy",
            "J.B. Duvernoy",
            "Jean-Baptiste Duvernoy",
            "Jean-Baptiste Duvernoy c. 1802 c. 1880",
        ];
        expect(new Set(spellings.map(canonicalComposer)).size).toBe(1);
    });

    it("does not eat a letter that only looks like circa", () => {
        // The "c" of circa has to be a word of its own. Without that anchor it matches the
        // last letter of a word that ends in one, and a 1708 hymnal loses its "a" with the
        // year — which changed what the public-domain rule read, three files away.
        expect(canonicalComposer("from Lyra Davidica 1708")).toBe("Traditional");
    });

    it("leaves a name that never carried dates alone", () => {
        expect(canonicalComposer("Carl Czerny")).toBe("Carl Czerny");
        expect(canonicalComposer("Ludwig van Beethoven")).toBe("Ludwig van Beethoven");
    });
});
