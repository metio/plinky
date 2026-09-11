// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What a note is called, which is not the same everywhere — and which the player decides.
//
// The on-screen keys already name every note the way the player chose in Settings
// (`noteLabels`: every key, just C, do re mi, or none). Everything else that names a note —
// a key's spoken name, the ear-training keys, the key-mapping caps, the chord readout,
// the tools and theory pages, a scale's title — must say what the keys say, or the app
// states two different names for one note. So there is one decision, `namingFor`, from
// the player's choice and the page's language to a naming system, and every surface asks
// it. A language only supplies the DEFAULT: Swedish called B natural H for a century and
// has taught B since the 1990s, and a player who learned either is right.
//
// Three families of names exist:
//
//   letters   C D E F G A B, with ♯ and ♭ — most of the world, and every chord symbol.
//   H letters C D E F G A H, where B alone means B flat and a sharp or flat is a
//             suffix: Cis, Es, As. German, and most of northern and central Europe,
//             each with its own suffix (German -is/-es, Swedish -iss/-ess, Hungarian
//             -isz/-esz).
//   solfège   do re mi fa sol la si, fixed so that do is always C — not a teaching aid
//             in the Romance, Greek and East Slavic traditions but simply what a note is
//             called. The syllables and the words for sharp and flat are translated
//             copy, so they arrive here as `NoteWords` rather than being spelled here.
//
// No name is ever written into a translated string: a message carries a {note} slot and
// this module fills it.

import { LETTERS } from "./notes";
import { type NoteNameId, noteNameOf, pitchClassOf } from "./theory";

export type NoteSystem =
    | "letters"
    // H letters with the German suffixes: Cis, Des, Es, As, B, H.
    | "german"
    // H letters with the Swedish suffixes, which Norwegian shares: Ciss, Dess, Ess, Ass.
    | "swedish"
    // H letters with the Hungarian suffixes: Cisz, Desz, Esz, Asz.
    | "hungarian"
    | "solfege";

// Whether the keys carry their note name, for a player still learning where the notes
// are: every key in letters (all), only the C keys as orientation landmarks (c — the
// white key left of each two-black-key group), every key in do re mi (solfege), or bare
// (off) once the map is second nature. Auto is every key named the way the page's
// language names a note, which is what the keys show until the player picks.
export type NoteLabels = "auto" | "all" | "c" | "solfege" | "off";

// Which name the letter systems give the last white key of the octave: B, H, or whatever
// the page's language uses (auto).
export type NoteLetters = "auto" | "b" | "h";

// Both choices are stored as auto until the player picks something other than the
// language's own, so a device follows a change of language rather than freezing the
// first one's habit — and picking the language's own again is the way back to auto.

// The whole decision, as every surface consumes it.
export type Naming = {
    system: NoteSystem;
    // Whether this language writes a minor key's tonic in lower case — h-Moll, a-mol,
    // fiss-moll — which is how its reader tells a minor key from its major at a glance.
    lowerMinor: boolean;
    // How a letter system says a black key's sharp aloud: the language's own way ("C
    // sharp", "C dièse"), or as a plain word after the letter ("A mit Kreuz"). Decided
    // here with the letters, because the two must agree: a German reader hears "Ais" as
    // the key below B, so a German keyboard that says "Ais" beside a key called "B" names
    // two neighbours alike and B natural not at all. The H systems say a key as they
    // print it, and do re mi always says the word.
    spokenSharp: "language" | "word";
};

// The translated vocabulary a name is built from. Solfège syllables are spelled per
// language (ré, ρε, ре), and so are the words for sharp and flat, so the caller hands
// them in and this module stays pure.
export type NoteWords = {
    // do re mi fa sol la si, in scale order from do.
    syllables: readonly string[];
    // A note raised or lowered, said in plain words: "ré dièse", "si bemolle",
    // "A mit Kreuz".
    sharp: (note: string) => string;
    flat: (note: string) => string;
    // The language's own spoken sharp on a letter: "C sharp", "C dièse", and in the H
    // languages a suffix — "Cis", "Ciss", "Cisz". A ♯ glyph is read out as "number" or
    // not at all, so a spoken name never carries one.
    spokenSharp: (note: string) => string;
};

type LocaleNaming = {
    // What a note is called when the player has not chosen: letters or solfège.
    names: "letters" | "solfege";
    // What the letter systems call B natural by default.
    b: "b" | "h";
    // The H system this language spells with, used whenever H is in force.
    h: "german" | "swedish" | "hungarian";
    lowerMinor: boolean;
};

const LETTERS_B: LocaleNaming = { names: "letters", b: "b", h: "german", lowerMinor: false };
const LETTERS_H: LocaleNaming = { names: "letters", b: "h", h: "german", lowerMinor: true };
const SOLFEGE: LocaleNaming = { names: "solfege", b: "b", h: "german", lowerMinor: false };

// The default for each language Plinky speaks, with the reason. Where a country is
// genuinely split, the default follows what its schools teach today; the player can
// always choose the other in Settings.
const LOCALE_NAMING: Record<string, LocaleNaming> = {
    en: LETTERS_B,
    // German reserves B for B flat and calls B natural H; minor keys are lower case
    // (h-Moll). "B-Dur" means the scale of B flat to every German reader.
    de: LETTERS_H,
    // Danish shares the German names outright — cis, es, as, b, h — and minor keys are
    // lower case (a-mol).
    da: LETTERS_H,
    // Finnish uses the German names (cis, es, b, h) and writes minor keys lower case.
    fi: LETTERS_H,
    // Polish, Czech, Slovak and Croatian teach the German names and lower-case minor
    // keys (a-moll, a mol).
    pl: LETTERS_H,
    cs: LETTERS_H,
    sk: LETTERS_H,
    hr: LETTERS_H,
    // Serbian music schools name keys by letter with H (C-dur, a-mol) and sing do-re-mi
    // as a sight-singing aid, so letters are what a key is called.
    sr: LETTERS_H,
    // Hungarian names pitches by letter with H and its own suffixes (cisz, esz, asz). The
    // dó-ré-mi a Hungarian child sings is Kodály's movable do, which names a step of the
    // scale rather than a pitch, so it cannot name a key on the keyboard.
    hu: { names: "letters", b: "h", h: "hungarian", lowerMinor: true },
    // Swedish is the split case: H with ciss/ess for a century, and B for B natural in the
    // schools since the 1990s. The default follows the schools; H stays one choice away.
    sv: { names: "letters", b: "b", h: "swedish", lowerMinor: true },
    // Norwegian spells like Swedish (ciss, ess) but has kept H: Norway's music dictionaries
    // and encyclopaedia (Musikkordboken, Store norske leksikon) call B natural H and B
    // flat B, with lower-case minor keys (h-moll).
    nb: { names: "letters", b: "h", h: "swedish", lowerMinor: true },
    // Dutch calls B natural b and B flat bes, so B is right; the -is spelling it says a
    // sharp with is already its word for the sharp.
    nl: LETTERS_B,
    // Japanese, Korean and Chinese sing do-re-mi in school but name keys with their own
    // letters (ハ長調, 다장조) or with Latin ones (C大调), and read chord symbols in Latin
    // letters. Plinky has no iroha or Korean letter names, so Latin letters with B.
    ja: LETTERS_B,
    ko: LETTERS_B,
    zh: LETTERS_B,
    // Fixed do: a note in these languages is do, ré, mi — "Sonate en si bémol majeur".
    fr: SOLFEGE,
    it: SOLFEGE,
    es: SOLFEGE,
    pt: SOLFEGE,
    ro: SOLFEGE,
    el: SOLFEGE,
    tr: SOLFEGE,
    // Albanian music follows the Italian tradition, do re mi.
    sq: SOLFEGE,
    // Russian and Ukrainian name notes до ре ми. Their letter notation, when a player asks
    // for letters, follows German: H is B natural and B is B flat.
    ru: { ...SOLFEGE, b: "h" },
    uk: { ...SOLFEGE, b: "h" },
};

function localeNaming(locale: string): LocaleNaming {
    return LOCALE_NAMING[locale.split("-")[0]?.toLowerCase() ?? ""] ?? LETTERS_B;
}

// The label choice, once auto is resolved for this language: do re mi in a fixed-do
// language, letters everywhere else.
export function labelsIn(labels: NoteLabels, locale: string): Exclude<NoteLabels, "auto"> {
    if (labels !== "auto") {
        return labels;
    }
    return localeNaming(locale).names === "solfege" ? "solfege" : "all";
}

// B or H, once auto is resolved for this language.
export function lettersIn(letters: NoteLetters, locale: string): "b" | "h" {
    return letters === "auto" ? localeNaming(locale).b : letters;
}

// What a pick stores: the language's own choice is stored as auto.
export function pickedLabels(labels: NoteLabels, locale: string): NoteLabels {
    return labels === labelsIn("auto", locale) ? "auto" : labels;
}

export function pickedLetters(letters: NoteLetters, locale: string): NoteLetters {
    return letters === lettersIn("auto", locale) ? "auto" : letters;
}

// The one decision. Letters on the keys mean letters everywhere, do re mi on the keys
// means do re mi everywhere; with auto, only C or nothing printed, the keys cannot
// contradict anything and the language's own way stands.
export function namingFor(
    labels: NoteLabels,
    locale: string,
    letters: NoteLetters = "auto",
): Naming {
    const own = localeNaming(locale);
    const letterSystem: NoteSystem = lettersIn(letters, locale) === "h" ? own.h : "letters";
    const system: NoteSystem =
        labels === "solfege"
            ? "solfege"
            : labels === "all"
              ? letterSystem
              : own.names === "solfege"
                ? "solfege"
                : letterSystem;
    return {
        system,
        lowerMinor: own.lowerMinor && system !== "solfege",
        // The language's own sharp, except where it would contradict the letters: B for B
        // natural in a language that reads B as B flat. There the sharp is said as a word,
        // so "Ais" never stands beside "B". Do re mi always says it as a word.
        spokenSharp:
            system === "solfege" || (system === "letters" && own.b === "h") ? "word" : "language",
    };
}

// Every key named, in the naming the player already reads: do re mi stays do re mi and
// letters stay letters, and a player showing only C or nothing gets the language's own.
// What a reading level asks for when it turns every key's name on.
export function everyKeyLabels(current: NoteLabels): "auto" | "all" | "solfege" {
    return current === "all" || current === "solfege" ? current : "auto";
}

const H_NATURAL = [...LETTERS.slice(0, 6), "H"];
const SHARP_SUFFIX: Record<"german" | "swedish" | "hungarian", string> = {
    german: "is",
    swedish: "iss",
    hungarian: "isz",
};
const INDEX: Record<string, number> = Object.fromEntries(
    LETTERS.map((letter, index) => [letter.toLowerCase(), index]),
);

type Accidental = -1 | 0 | 1;

// A note id ("d-flat") or a key slug ("dflat") as a degree of the scale from C and an
// accidental. Both shapes are a letter followed by sharp or flat, so one reader serves.
function parse(name: string): { index: number; accidental: Accidental } | null {
    const index = INDEX[name[0]?.toLowerCase() ?? ""];
    if (index === undefined) {
        return null;
    }
    return { index, accidental: name.endsWith("sharp") ? 1 : name.endsWith("flat") ? -1 : 0 };
}

// An H-system name. The sharp suffixes a letter (Cis, Ciss, Cisz); the flat suffixes it
// with an e (Ces, Cess, Cesz), which a vowel swallows (Es not Ees, As not Aes) — and the
// flat of H is B, the whole reason these systems exist.
function hName(index: number, accidental: Accidental, system: keyof typeof SHARP_SUFFIX): string {
    const natural = H_NATURAL[index] as string;
    const suffix = SHARP_SUFFIX[system];
    if (accidental === 1) {
        return `${natural}${suffix}`;
    }
    if (accidental === 0) {
        return natural;
    }
    if (natural === "H") {
        return "B";
    }
    const flat = `e${suffix.slice(1)}`;
    return natural === "E" || natural === "A" ? `${natural}${flat.slice(1)}` : `${natural}${flat}`;
}

// A note in letters with its sign: C♯, B♭. The letter system, and what a chord symbol or
// a picture drawn with no reader in mind falls back on.
export function letterNameOf(name: NoteNameId | string): string {
    const parsed = parse(name);
    if (parsed === null) {
        return name.toUpperCase();
    }
    const natural = LETTERS[parsed.index] as string;
    return parsed.accidental === 1
        ? `${natural}♯`
        : parsed.accidental === -1
          ? `${natural}♭`
          : natural;
}

function spell(name: string, system: NoteSystem, words: NoteWords, glyphs: boolean): string {
    if (system === "letters") {
        return letterNameOf(name);
    }
    const parsed = parse(name);
    if (parsed === null) {
        return name.toUpperCase();
    }
    const { index, accidental } = parsed;
    if (system !== "solfege") {
        return hName(index, accidental, system);
    }
    const syllable = words.syllables[index] ?? "";
    if (accidental === 0) {
        return syllable;
    }
    if (glyphs) {
        return `${syllable}${accidental === 1 ? "♯" : "♭"}`;
    }
    return accidental === 1 ? words.sharp(syllable) : words.flat(syllable);
}

// A spelled note or key slug as a sentence writes it: C♯, Cis, "ré dièse". A letter
// system writes its signs, because C♯ is how English prose writes C sharp; do-re-mi
// languages write the word, because "si bémol majeur" is how theirs does.
export function noteTextIn(
    name: NoteNameId | string,
    system: NoteSystem,
    words: NoteWords,
): string {
    return spell(name, system, words, false);
}

// The same note as a label or a chord symbol writes it — short, signs rather than words:
// C♯, Cis, ré♯. What a key prints, what an answer key or a root picker shows, and what a
// chord symbol is built on ("si♭m", never "si bémolm").
export function noteSymbolIn(
    name: NoteNameId | string,
    system: NoteSystem,
    words: NoteWords,
): string {
    return spell(name, system, words, true);
}

// The tonic of a minor key. Lower case where the language writes it so — h-Moll,
// fis-moll, es-mol — and as it is everywhere else.
export function minorKeyTextIn(
    name: NoteNameId | string,
    naming: Naming,
    words: NoteWords,
): string {
    const text = noteTextIn(name, naming.system, words);
    return naming.lowerMinor ? text.toLowerCase() : text;
}

// A name that opens a sentence or a title. Syllables are lower-case words in the
// languages that use them — "re maggiore" mid-sentence — so one at the very start is
// capitalised, as the language capitalises any first word. Letter names already are, and
// a lower-case minor tonic in an H language keeps its case: that case is the meaning.
export function openingIn(text: string, system: NoteSystem, locale: string): string {
    if (system !== "solfege" || text === "") {
        return text;
    }
    const first = String.fromCodePoint(text.codePointAt(0) ?? 0);
    return `${first.toLocaleUpperCase(locale)}${text.slice(first.length)}`;
}

// The keyboard's own spelling: a black key is named from the white key below it.
const slugOf = (midi: number): string => noteNameOf(pitchClassOf(midi));

// What a key prints when it is named, any octave.
export function pitchLabelIn(midi: number, system: NoteSystem, words: NoteWords): string {
    return noteSymbolIn(slugOf(midi), system, words);
}

// What a key prints under the player's label choice: every key, only the C keys, or
// nothing. Which keys get a name is the choice; what the name is, the system decides.
export function keyLabelIn(
    midi: number,
    labels: NoteLabels,
    system: NoteSystem,
    words: NoteWords,
): string | null {
    if (labels === "off") {
        return null;
    }
    if (labels === "c" && ((midi % 12) + 12) % 12 !== 0) {
        return null;
    }
    return pitchLabelIn(midi, system, words);
}

// A key as a screen reader should say it, without its octave: "C sharp", "Cis",
// "do dièse". A white key is its name, and so is any key of an H system, whose printed
// name (Cis, Ciss, Cisz) is already how it is said. A black key otherwise is the white
// key below it with the sharp said as the naming decided — never a glyph.
export function spokenNoteIn(midi: number, naming: Naming, words: NoteWords): string {
    const slug = slugOf(midi);
    if (!slug.endsWith("sharp") || (naming.system !== "letters" && naming.system !== "solfege")) {
        return noteTextIn(slug, naming.system, words);
    }
    const below = noteSymbolIn(slug.slice(0, 1), naming.system, words);
    return naming.spokenSharp === "word" ? words.sharp(below) : words.spokenSharp(below);
}

// The octave a key sits in, counted so that middle C (MIDI 60) is C4.
export function octaveOf(midi: number): number {
    return Math.floor(midi / 12) - 1;
}

// The same with its octave — an octave digit run onto the name is spoken as one word,
// so it stands apart.
export function spokenKeyIn(midi: number, naming: Naming, words: NoteWords): string {
    return `${spokenNoteIn(midi, naming, words)} ${octaveOf(midi)}`;
}

// The natural names of the letter systems, in scale order: the two choices a player is
// offered for the last white key of the octave.
export function naturalsIn(letters: "b" | "h"): readonly string[] {
    return letters === "h" ? H_NATURAL : LETTERS;
}
