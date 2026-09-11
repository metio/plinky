// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import {
    everyKeyLabels,
    keyLabelIn,
    labelsIn,
    lettersIn,
    minorKeyTextIn,
    type NoteSystem,
    type NoteWords,
    namingFor,
    naturalsIn,
    noteSymbolIn,
    noteTextIn,
    openingIn,
    pickedLabels,
    pickedLetters,
    pitchLabelIn,
    spokenKeyIn,
    spokenNoteIn,
} from "./noteNaming";
import { NOTE_TEXT, type NoteNameId } from "./theory";

// Stand-in translations: the real ones are paraglide messages, which core never reads.
const WORDS: NoteWords = {
    syllables: ["do", "re", "mi", "fa", "sol", "la", "si"],
    sharp: (note) => `${note} sharp`,
    flat: (note) => `${note} flat`,
    spokenSharp: (note) => `${note} sharp`,
};

const NOTE_IDS = Object.keys(NOTE_TEXT) as NoteNameId[];
const text = (name: string, system: NoteSystem) => noteTextIn(name, system, WORDS);

// What a device that has chosen nothing reads, in each language.
const fresh = (locale: string) => namingFor("auto", locale);

describe("each language's default", () => {
    it.each([
        // [locale, what the keys print, the naming system, lower-case minor tonics]
        ["en", "all", "letters", false],
        ["nl", "all", "letters", false],
        ["ja", "all", "letters", false],
        ["ko", "all", "letters", false],
        ["zh", "all", "letters", false],
        ["de", "all", "german", true],
        ["da", "all", "german", true],
        ["fi", "all", "german", true],
        ["pl", "all", "german", true],
        ["cs", "all", "german", true],
        ["sk", "all", "german", true],
        ["hr", "all", "german", true],
        ["sr", "all", "german", true],
        ["hu", "all", "hungarian", true],
        // Swedish follows today's schools: B, with lower-case minor keys.
        ["sv", "all", "letters", true],
        ["nb", "all", "swedish", true],
        ["fr", "solfege", "solfege", false],
        ["it", "solfege", "solfege", false],
        ["es", "solfege", "solfege", false],
        ["pt", "solfege", "solfege", false],
        ["ro", "solfege", "solfege", false],
        ["el", "solfege", "solfege", false],
        ["tr", "solfege", "solfege", false],
        ["sq", "solfege", "solfege", false],
        ["ru", "solfege", "solfege", false],
        ["uk", "solfege", "solfege", false],
    ] as const)("%s prints %s and names notes in %s", (locale, labels, system, lowerMinor) => {
        expect(labelsIn("auto", locale)).toBe(labels);
        expect(fresh(locale)).toMatchObject({ system, lowerMinor });
    });

    it("reads a regional tag by its language, and falls back to letters for the unknown", () => {
        expect(fresh("pt-BR").system).toBe("solfege");
        expect(fresh("de-AT").system).toBe("german");
        expect(fresh("xx").system).toBe("letters");
    });
});

describe("spelling in each language's letters", () => {
    it.each([
        // [locale, letters, B natural, B flat, C sharp, E flat, A flat, B minor]
        ["en", "auto", "B", "B♭", "C♯", "E♭", "A♭", "B"],
        ["de", "auto", "H", "B", "Cis", "Es", "As", "h"],
        ["da", "auto", "H", "B", "Cis", "Es", "As", "h"],
        ["fi", "auto", "H", "B", "Cis", "Es", "As", "h"],
        ["pl", "auto", "H", "B", "Cis", "Es", "As", "h"],
        ["cs", "auto", "H", "B", "Cis", "Es", "As", "h"],
        ["sk", "auto", "H", "B", "Cis", "Es", "As", "h"],
        ["hr", "auto", "H", "B", "Cis", "Es", "As", "h"],
        ["sr", "auto", "H", "B", "Cis", "Es", "As", "h"],
        ["hu", "auto", "H", "B", "Cisz", "Esz", "Asz", "h"],
        ["sv", "auto", "B", "B♭", "C♯", "E♭", "A♭", "b"],
        ["sv", "h", "H", "B", "Ciss", "Ess", "Ass", "h"],
        ["nb", "auto", "H", "B", "Ciss", "Ess", "Ass", "h"],
        ["nb", "h", "H", "B", "Ciss", "Ess", "Ass", "h"],
        ["de", "b", "B", "B♭", "C♯", "E♭", "A♭", "b"],
        ["en", "h", "H", "B", "Cis", "Es", "As", "H"],
        ["nl", "auto", "B", "B♭", "C♯", "E♭", "A♭", "B"],
        ["ja", "auto", "B", "B♭", "C♯", "E♭", "A♭", "B"],
        // Letters in a do-re-mi language, when the player asks for them.
        ["fr", "auto", "B", "B♭", "C♯", "E♭", "A♭", "B"],
        ["ru", "auto", "H", "B", "Cis", "Es", "As", "H"],
        ["uk", "auto", "H", "B", "Cis", "Es", "As", "H"],
    ] as const)(
        "%s with %s letters",
        (locale, letters, bNatural, bFlat, cSharp, eFlat, aFlat, bMinor) => {
            const naming = namingFor("all", locale, letters);
            expect(text("b", naming.system)).toBe(bNatural);
            expect(text("b-flat", naming.system)).toBe(bFlat);
            expect(text("c-sharp", naming.system)).toBe(cSharp);
            expect(text("e-flat", naming.system)).toBe(eFlat);
            expect(text("a-flat", naming.system)).toBe(aFlat);
            expect(minorKeyTextIn("b", naming, WORDS)).toBe(bMinor);
        },
    );

    it("spells the signature-only names a key at the circle's cut needs", () => {
        expect(text("e-sharp", "german")).toBe("Eis");
        expect(text("b-sharp", "german")).toBe("His");
        expect(text("c-flat", "german")).toBe("Ces");
        expect(text("f-flat", "german")).toBe("Fes");
        expect(text("b-sharp", "swedish")).toBe("Hiss");
        expect(text("c-flat", "swedish")).toBe("Cess");
        expect(text("b-sharp", "hungarian")).toBe("Hisz");
        expect(text("c-flat", "hungarian")).toBe("Cesz");
    });

    it("writes every spelled note exactly as the letter table does, in letters", () => {
        for (const id of NOTE_IDS) {
            expect(text(id, "letters")).toBe(NOTE_TEXT[id]);
        }
    });

    it("gives every spelled note its own H name, with no sign left in it", () => {
        for (const system of ["german", "swedish", "hungarian"] as const) {
            const names = NOTE_IDS.map((id) => text(id, system));
            expect(new Set(names).size).toBe(names.length);
            for (const name of names) {
                expect(name).not.toMatch(/[♯♭]/);
            }
        }
    });

    it("reads a key slug the way it reads a note id", () => {
        expect(text("eflat", "german")).toBe(text("e-flat", "german"));
        expect(text("fsharp", "letters")).toBe("F♯");
    });

    it("hands back something rather than nothing for a slug it does not know", () => {
        expect(text("", "german")).toBe("");
        expect(text("zebra", "german")).toBe("ZEBRA");
    });
});

describe("spelling in do re mi", () => {
    it("writes a raised or lowered syllable with the language's word in a sentence", () => {
        expect(text("b-flat", "solfege")).toBe("si flat");
        expect(text("f-sharp", "solfege")).toBe("fa sharp");
        expect(text("d", "solfege")).toBe("re");
    });

    it("writes it with a sign on a label or a chord symbol", () => {
        expect(noteSymbolIn("b-flat", "solfege", WORDS)).toBe("si♭");
        expect(noteSymbolIn("c-sharp", "solfege", WORDS)).toBe("do♯");
    });

    it("never lower-cases a syllable for a minor key: it already is one", () => {
        expect(minorKeyTextIn("d", fresh("fr"), WORDS)).toBe("re");
    });
});

describe("namingFor", () => {
    it("says do re mi everywhere once the keys say it, in any language", () => {
        expect(namingFor("solfege", "de").system).toBe("solfege");
        expect(namingFor("solfege", "en").system).toBe("solfege");
    });

    it("says letters everywhere once the keys print letters, in any language", () => {
        expect(namingFor("all", "fr").system).toBe("letters");
        expect(namingFor("all", "it").system).toBe("letters");
    });

    it("keeps the language's own names while the keys print only C or nothing", () => {
        expect(namingFor("c", "fr").system).toBe("solfege");
        expect(namingFor("off", "fr").system).toBe("solfege");
        expect(namingFor("c", "de").system).toBe("german");
        expect(namingFor("off", "en").system).toBe("letters");
    });

    it("lets the player's B or H win over the language's", () => {
        expect(namingFor("all", "de", "b").system).toBe("letters");
        expect(namingFor("all", "sv", "h").system).toBe("swedish");
        expect(namingFor("off", "en", "h").system).toBe("german");
    });

    it("writes minor keys lower case only in a letter system of a language that does", () => {
        expect(namingFor("all", "de").lowerMinor).toBe(true);
        expect(namingFor("solfege", "de").lowerMinor).toBe(false);
        expect(namingFor("all", "en", "h").lowerMinor).toBe(false);
    });
});

describe("the player's choices resolved", () => {
    it("names every key in the naming the player already reads", () => {
        expect(everyKeyLabels("solfege")).toBe("solfege");
        expect(everyKeyLabels("all")).toBe("all");
        expect(everyKeyLabels("off")).toBe("auto");
        expect(everyKeyLabels("c")).toBe("auto");
        expect(everyKeyLabels("auto")).toBe("auto");
    });

    it("resolves auto labels to the language's and keeps a chosen one", () => {
        expect(labelsIn("auto", "fr")).toBe("solfege");
        expect(labelsIn("auto", "de")).toBe("all");
        expect(labelsIn("c", "fr")).toBe("c");
        expect(labelsIn("all", "fr")).toBe("all");
    });

    it("stores a pick of the language's own choice as auto, and any other as picked", () => {
        expect(pickedLabels("solfege", "fr")).toBe("auto");
        expect(pickedLabels("all", "fr")).toBe("all");
        expect(pickedLabels("all", "en")).toBe("auto");
        expect(pickedLabels("off", "en")).toBe("off");
        expect(pickedLetters("h", "de")).toBe("auto");
        expect(pickedLetters("b", "de")).toBe("b");
        expect(pickedLetters("b", "en")).toBe("auto");
        expect(pickedLetters("h", "en")).toBe("h");
    });

    it("resolves auto letters to the language's and keeps a chosen one", () => {
        expect(lettersIn("auto", "de")).toBe("h");
        expect(lettersIn("auto", "sv")).toBe("b");
        expect(lettersIn("b", "de")).toBe("b");
        expect(lettersIn("h", "en")).toBe("h");
    });

    it("offers the two sets of naturals by what they are called", () => {
        expect(naturalsIn("b").join(" ")).toBe("C D E F G A B");
        expect(naturalsIn("h").join(" ")).toBe("C D E F G A H");
    });
});

describe("what a key prints", () => {
    it("names every key when every key is to be named, in the system asked for", () => {
        expect(keyLabelIn(61, "all", "letters", WORDS)).toBe("C♯");
        expect(keyLabelIn(61, "all", "german", WORDS)).toBe("Cis");
        expect(keyLabelIn(59, "all", "german", WORDS)).toBe("H");
        expect(keyLabelIn(61, "solfege", "solfege", WORDS)).toBe("do♯");
    });

    it("prints only on the C keys when C is the landmark asked for, in the reader's name", () => {
        expect(keyLabelIn(60, "c", "letters", WORDS)).toBe("C");
        expect(keyLabelIn(72, "c", "solfege", WORDS)).toBe("do");
        expect(keyLabelIn(61, "c", "letters", WORDS)).toBeNull();
        expect(keyLabelIn(62, "c", "solfege", WORDS)).toBeNull();
    });

    it("prints nothing when the labels are off", () => {
        expect(keyLabelIn(60, "off", "letters", WORDS)).toBeNull();
        expect(keyLabelIn(61, "off", "solfege", WORDS)).toBeNull();
    });

    it("names the same key in every octave, and below MIDI zero", () => {
        expect(pitchLabelIn(0, "solfege", WORDS)).toBe(pitchLabelIn(60, "solfege", WORDS));
        expect(pitchLabelIn(-1, "german", WORDS)).toBe("H");
    });
});

describe("what a key is called aloud", () => {
    // How the H languages say a sharp: a suffix, which their messages carry.
    const GERMAN: NoteWords = {
        ...WORDS,
        sharp: (note) => `${note} mit Kreuz`,
        spokenSharp: (note) => `${note}is`,
    };
    const HUNGARIAN: NoteWords = { ...WORDS, spokenSharp: (note) => `${note}isz` };

    it("names a black key from the white key below it and the language's sharp", () => {
        expect(spokenKeyIn(61, namingFor("all", "en"), WORDS)).toBe("C sharp 4");
        expect(spokenKeyIn(70, namingFor("all", "en"), WORDS)).toBe("A sharp 4");
    });

    it("says a German black key with the German suffix and B natural as H", () => {
        const german = namingFor("all", "de");
        expect(spokenKeyIn(61, german, GERMAN)).toBe("Cis 4");
        expect(spokenKeyIn(70, german, GERMAN)).toBe("Ais 4");
        expect(spokenKeyIn(59, german, GERMAN)).toBe("H 3");
        expect(spokenNoteIn(66, namingFor("all", "hu"), HUNGARIAN)).toBe("Fisz");
    });

    it("says the sharp as a word where B means B natural in a language that reads it as B flat", () => {
        // "Ais" beside "B" names two neighbouring keys alike in German.
        const withB = namingFor("all", "de", "b");
        expect(withB.spokenSharp).toBe("word");
        expect(spokenNoteIn(70, withB, GERMAN)).toBe("A mit Kreuz");
        expect(spokenNoteIn(71, withB, GERMAN)).toBe("B");
    });

    it("keeps the language's own sharp wherever B is its own convention", () => {
        expect(namingFor("all", "sv").spokenSharp).toBe("language");
        expect(namingFor("all", "nl").spokenSharp).toBe("language");
        expect(namingFor("all", "en", "h").spokenSharp).toBe("language");
    });

    it("says a raised syllable in words", () => {
        expect(spokenKeyIn(61, namingFor("solfege", "fr"), WORDS)).toBe("do sharp 4");
        expect(namingFor("solfege", "de").spokenSharp).toBe("word");
    });

    it("numbers the octaves the way a piano is labelled, middle C in the fourth", () => {
        expect(spokenKeyIn(21, namingFor("all", "en"), WORDS)).toBe("A 0");
        expect(spokenKeyIn(108, namingFor("all", "en"), WORDS)).toBe("C 8");
    });
});

describe("openingIn", () => {
    it("capitalises a syllable that opens a line", () => {
        expect(openingIn("re maggiore si scrive con fa diesis.", "solfege", "it")).toBe(
            "Re maggiore si scrive con fa diesis.",
        );
        expect(openingIn("ρε μείζονα", "solfege", "el")).toBe("Ρε μείζονα");
    });

    it("leaves a letter name and a lower-case German minor tonic as they are", () => {
        expect(openingIn("h-Moll", "german", "de")).toBe("h-Moll");
        expect(openingIn("B major", "letters", "en")).toBe("B major");
        expect(openingIn("", "solfege", "fr")).toBe("");
    });
});
