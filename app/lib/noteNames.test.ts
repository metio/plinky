// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { afterEach, describe, expect, it } from "vitest";
import {
    keyLabelIn,
    lettersIn,
    type NoteLetters,
    namingFor,
    pitchLabelIn,
    spokenNoteIn,
} from "../../core/noteNaming";
import { DEFAULT_PREFS } from "../../core/prefs";
import { noteWords } from "../components/ui/noteWords";
import { m } from "../paraglide/messages.js";
import { baseLocale, type Locale, locales, overwriteGetLocale } from "../paraglide/runtime.js";
import { localNaming, namingOf, noteText, pitchName } from "./noteNames";

afterEach(() => overwriteGetLocale(() => baseLocale));

const inLocale = <T>(locale: Locale, read: () => T): T => {
    overwriteGetLocale(() => locale);
    return read();
};

// The naming table and the translated sharp words are kept in two places — core and the
// message catalogue — so these read both, through the real messages of every language,
// and fail the moment they disagree.
describe.each(locales.map((locale) => [locale]))("note names in %s", (locale) => {
    it("says the twelve keys of an octave with twelve different names", () => {
        inLocale(locale, () => {
            const naming = localNaming();
            const said = Array.from({ length: 12 }, (_, step) =>
                spokenNoteIn(60 + step, naming, noteWords()),
            );
            expect(new Set(said).size).toBe(12);
        });
    });

    it("speaks an H language's black key exactly as its key prints it", () => {
        // The German sharp word is a suffix, and so is the spelling core prints on the key;
        // a message that drifted from the table would say one name and print another. Only
        // the languages whose own names are H letters: Russian letters are H letters too,
        // but its sharp is the word диез, which says the same note another way.
        inLocale(locale, () => {
            const naming = localNaming();
            if (naming.system === "letters" || naming.system === "solfege") {
                return;
            }
            for (const black of [61, 63, 66, 68, 70]) {
                expect(spokenNoteIn(black, naming, noteWords())).toBe(
                    pitchLabelIn(black, naming.system, noteWords()),
                );
            }
        });
    });

    it.each(["auto", "b", "h"] as NoteLetters[])(
        "never calls B natural B beside the language's B-flat-side sharp (%s letters)",
        (letters) => {
            inLocale(locale, () => {
                const naming = namingFor("all", locale, letters);
                const bNatural = spokenNoteIn(71, naming, noteWords());
                const aSharp = spokenNoteIn(70, naming, noteWords());
                if (bNatural === "B" && lettersIn("auto", locale) === "h") {
                    expect(aSharp).not.toBe(m.keyboard_key_sharp({ note: "A" }, { locale }));
                }
            });
        },
    );

    it("prints on a fresh device's keys the names every other surface uses", () => {
        inLocale(locale, () => {
            const prefs = DEFAULT_PREFS;
            const naming = namingOf(prefs);
            for (let step = 0; step < 12; step += 1) {
                const printed = keyLabelIn(60 + step, prefs.noteLabels, naming.system, noteWords());
                expect(printed).toBe(pitchLabelIn(60 + step, naming.system, noteWords()));
            }
        });
    });
});

describe("what a readout calls a key", () => {
    it("prints the key as the keys do, with middle C in the fourth octave", () => {
        expect(pitchName(60, localNaming())).toBe("C4");
        expect(pitchName(21, localNaming())).toBe("A0");
        expect(pitchName(108, localNaming())).toBe("C8");
        expect(pitchName(61, localNaming())).toBe("C♯4");
    });

    it("says H and Ais in German and la in French", () => {
        expect(inLocale("de", () => pitchName(71, localNaming()))).toBe("H4");
        expect(inLocale("de", () => pitchName(70, localNaming()))).toBe("Ais4");
        expect(inLocale("fr", () => pitchName(69, localNaming()))).toBe("la4");
        expect(inLocale("fr", () => pitchName(70, localNaming()))).toBe("la♯4");
    });

    it("follows the player's choice over the language's", () => {
        expect(
            inLocale("fr", () =>
                pitchName(71, namingOf({ noteLabels: "all", noteLetters: "auto" })),
            ),
        ).toBe("B4");
        expect(
            inLocale("en", () => pitchName(71, namingOf({ noteLabels: "all", noteLetters: "h" }))),
        ).toBe("H4");
    });
});

describe("what a sentence calls a note", () => {
    it("writes a French flat as a word, and an Italian one", () => {
        expect(inLocale("fr", () => noteText("b-flat", localNaming()))).toBe("si bémol");
        expect(inLocale("it", () => noteText("b-flat", localNaming()))).toBe("si bemolle");
    });

    it("writes a Russian sharp the Russian way", () => {
        expect(inLocale("ru", () => noteText("c-sharp", localNaming()))).toBe("до-диез");
    });

    it("writes a German one spelled, and an English one with its sign", () => {
        expect(inLocale("de", () => noteText("b-flat", localNaming()))).toBe("B");
        expect(inLocale("en", () => noteText("b-flat", localNaming()))).toBe("B♭");
    });
});
