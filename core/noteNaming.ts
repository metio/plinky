// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What a note is called, which is not the same everywhere.
//
// Plinky names notes with English letters in all twenty-six languages, and in German that
// is not a spelling difference but a different note: German notation calls B natural **H**
// and reserves **B** for B flat. So "B-Dur-Tonleiter" tells a German student to play the
// scale of B flat when the app means B natural — the app stating the wrong note, in the
// one place a beginner has no way to check.
//
// Only German is mapped here. Danish, Norwegian, Swedish, Finnish, Polish, Czech, Slovak,
// Hungarian, Croatian and Serbian also call B natural H, and each spells its accidentals
// its own way — "Ess" or "Eb", "Aisz" or "Ais". Guessing those would replace one wrong
// name with another, so they stay on letters until somebody who reads them supplies the
// spellings. The seam is here for when they do.

export type NoteSystem =
    // C D E F G A B, with ♯ and ♭. What most of the world reads and what Plinky did
    // everywhere.
    | "letters"
    // C D E F G A H, where B alone means B flat and accidentals are spelled as words:
    // Cis, Des, Es, Fis, As.
    | "german";

// Fixed-do languages — French, Italian, Spanish, Portuguese, Romanian, Greek, Russian —
// name notes do-re-mi rather than by letter. That is a third system and a larger change:
// the syllables are already translated for the piano keys (see solfegeOf and the
// note_solfege_* messages), but naming a key or a chord in prose means those messages
// reaching every sentence that currently interpolates a letter. Deliberately not
// attempted here rather than half-done.
export function noteSystemFor(locale: string): NoteSystem {
    return locale === "de" ? "german" : "letters";
}

const GERMAN_NATURAL = ["C", "D", "E", "F", "G", "A", "H"];
const LETTER_NATURAL = ["C", "D", "E", "F", "G", "A", "B"];
const INDEX: Record<string, number> = { c: 0, d: 1, e: 2, f: 3, g: 4, a: 5, b: 6 };

// A key slug — "c", "eflat", "fsharp" — as a musician reading this language writes it.
//
// German spells a sharp by suffixing "is" and a flat by suffixing "es", with the four
// contractions every German musician uses instead of the regular form: Es not Ees, As not
// Aes, and B not Hes. The vowel-stem ones (Es, As) are contractions of the spoken word,
// which is why they are listed rather than derived.
export function keyNameIn(slug: string, system: NoteSystem): string {
    const sharp = slug.endsWith("sharp");
    const flat = slug.endsWith("flat");
    const letter = slug[0]?.toLowerCase() ?? "";
    const index = INDEX[letter];
    if (index === undefined) {
        return slug.toUpperCase();
    }
    if (system === "letters") {
        const natural = LETTER_NATURAL[index] as string;
        return sharp ? `${natural}♯` : flat ? `${natural}♭` : natural;
    }
    const natural = GERMAN_NATURAL[index] as string;
    if (sharp) {
        return `${natural}is`;
    }
    if (!flat) {
        return natural;
    }
    return GERMAN_FLAT[index] as string;
}

// Ces Des Es Fes Ges As B — the flat of each degree, with the three the language
// contracts. B is the flat of H, which is the whole reason this module exists.
const GERMAN_FLAT = ["Ces", "Des", "Es", "Fes", "Ges", "As", "B"];
