// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Decides whether a MusicXML score belongs in a *piano* catalogue. Shared by the
// import pipeline (to reject non-piano scores up front) and the catalogue audit (to
// flag ones that slipped in). Conservative by design: only a confident non-piano
// signal flags a score, so a real keyboard piece is never dropped.

import type { ScoreKind } from "../core/scoreKind.ts";

const KEYBOARD = /piano|keyboard|klavier|clavier|harpsichord|clavichord|celesta|organ/;
const OTHER_INSTRUMENT =
    /drum|percussion|cymbal|guitar|\bbass\b|violin|cello|viola|contrabass|flute|trumpet|saxophone|\bsax\b|clarinet|oboe|bassoon|trombone|tuba|\bhorn\b|choir|\bvoice\b|vocal|ukulele|banjo|mandolin|\bharp\b|recorder|piccolo|accordion|\bsynth/;

// Non-keyboard melodic/percussion instruments, for the piano-OR-vocal gate below.
// "bass" alone stays out (it's a voice part in art song); a real double bass reads as
// "contrabass" / "double bass".
const INSTRUMENTAL =
    /drum|percussion|cymbal|guitar|violin|cello|viola|contrabass|double.?bass|flute|trumpet|saxophone|\bsax\b|clarinet|oboe|bassoon|trombone|tuba|\bhorn\b|ukulele|banjo|mandolin|\bharp\b|recorder|piccolo|accordion|\bsynth|string|brass|orchestr/;

// A staff that is not a five-line pitched staff is not piano music, whatever its parts
// are called. Guitar tablature (TAB) engraves as six lines of fret numbers, jianpu as
// cipher digits, a percussion staff as one line — each renders as something a pianist
// cannot read, while the pitches underneath stay correct, so the piece PLAYS fine and
// only LOOKS wrong. That combination is invisible to every other check here, which reads
// part names.
//
// This is not hypothetical: seven guitar and lute pieces reached the catalogue as
// tablature, Satie's Gymnopédie No.1 among them, and were only found when a player asked
// why one of them looked so strange.
// The names a sung part carries. Kept beside the other vocabularies rather than inside
// the classifier, so a corpus that spells a voice a new way is fixed in one place.
const VOCAL =
    /voice|vocal|voci|singstimme|gesang|soprano|sopran|mezzo|alto|contralto|tenor|baritone|bariton|bass\b|basso|chor|choir|coro|cantus|discantus|superius/;

const NON_PIANO_CLEF = /<sign>\s*(TAB|jianpu)\s*<\/sign>/i;
const NON_STANDARD_STAFF = /<staff-lines>\s*(?!5\s*<)\d+\s*<\/staff-lines>/i;

// Returns the disqualifying reason, or null when the score is a (probable) piano piece.
export function nonPianoReason(xml: string): string | null {
    // Unpitched notes / a percussion clef are unambiguous — a drum kit, not a piano.
    if (/<sign>\s*percussion\s*<\/sign>/i.test(xml) || /<unpitched\b/i.test(xml)) {
        return "percussion";
    }
    if (NON_PIANO_CLEF.test(xml)) {
        return "tablature";
    }
    if (NON_STANDARD_STAFF.test(xml)) {
        return "non-standard-staff";
    }
    const names = instrumentNames(xml);
    // A clearly-named other instrument with no keyboard part anywhere.
    if (!KEYBOARD.test(names) && OTHER_INSTRUMENT.test(names)) {
        return "named-instrument";
    }
    return null;
}

// Clef names used as staff labels, not instruments. A converted piano score often names
// its two staves "treble" and "bass" — LilyPond does — and reading that "bass" as a bass
// instrument threw out real piano music, Satie's Gymnopédies among them. A double bass
// says so ("contrabass", "double bass"), which these patterns still catch.
const STAFF_LABEL = /^(treble|bass|right|left|upper|lower|rh|lh)\b[\s:.-]*$/;

function instrumentNames(xml: string): string {
    return [
        ...xml.matchAll(
            /<(?:part-name|instrument-name)[^>]*>([^<]*)<\/(?:part-name|instrument-name)>/gi,
        ),
    ]
        .map((match) => match[1]!.trim().toLowerCase())
        .filter((name) => !STAFF_LABEL.test(name))
        .join(" | ");
}

// Stricter than nonPianoReason, for curating a SOLO/duet-piano catalogue on a relaxed
// import: also rejects ensemble scores — any non-keyboard instrument named at all (even
// alongside a piano), or more than two parts (an arrangement, not a piano solo/duet).
export function nonSoloPianoReason(xml: string): string | null {
    const base = nonPianoReason(xml);
    if (base) {
        return base;
    }
    if (OTHER_INSTRUMENT.test(instrumentNames(xml))) {
        return "ensemble";
    }
    if ((xml.match(/<score-part\b/gi) ?? []).length > 2) {
        return "multi-part";
    }
    return null;
}

// For a piano-OR-vocal catalogue (art song: a vocal line over a keyboard part). Keeps a
// score only when a keyboard part is present and every other part is vocal — so
// voice+piano Lieder and accompanied choir stay, while a-cappella choir (no keyboard)
// and any instrumental ensemble (a violin, flute, drums, … alongside the piano) are
// dropped. Each part is classified in isolation so "Piano (or Harp)" reads as keyboard,
// not as a harp.
export function nonPianoVocalReason(xml: string): string | null {
    if (/<sign>\s*percussion\s*<\/sign>/i.test(xml) || /<unpitched\b/i.test(xml)) {
        return "percussion";
    }
    if (NON_PIANO_CLEF.test(xml)) {
        return "tablature";
    }
    if (NON_STANDARD_STAFF.test(xml)) {
        return "non-standard-staff";
    }
    const names = [
        ...xml.matchAll(
            /<(?:part-name|instrument-name)[^>]*>([^<]*)<\/(?:part-name|instrument-name)>/gi,
        ),
    ].map((match) => match[1]!.trim().toLowerCase());
    let hasKeyboard = false;
    for (const name of names) {
        if (KEYBOARD.test(name)) {
            hasKeyboard = true;
        } else if (INSTRUMENTAL.test(name)) {
            return "ensemble";
        }
    }
    if (!hasKeyboard) {
        return "no-keyboard";
    }
    return null;
}

// What a score IS, rather than whether a given catalogue will take it.
//
// The gates above answer one question — may this in? — and throw the answer away. That is
// what left the catalogue unable to tell a beginner's solo piece from a Schubert
// accompaniment: both passed some gate, and nothing recorded which. Keeping the answer is
// what lets the grade ladder draw only from solo piano while the library keeps the songs.

// The kind of a score read from the file itself. Only worth asking for a mixed corpus like
// PDMX — a curated source knows what it harvested and says so in its config, which is both
// cheaper and more truthful than re-deriving it here.
export type { ScoreKind };

export function scoreKind(xml: string): ScoreKind {
    if (nonPianoReason(xml)) {
        return "other";
    }
    // The same names nonPianoReason reads, with the staff labels a converted piano score
    // gives its two staves already dropped: a "bass" staff is not a bass singer.
    const names = instrumentNames(xml).split(" | ").filter(Boolean);
    let keyboard = false;
    let vocal = false;
    for (const name of names) {
        if (KEYBOARD.test(name)) {
            keyboard = true;
        } else if (VOCAL.test(name)) {
            vocal = true;
        } else if (INSTRUMENTAL.test(name) || OTHER_INSTRUMENT.test(name)) {
            return "other";
        }
    }
    if (vocal) {
        return keyboard ? "voice-and-piano" : "choral-reduction";
    }
    // More than two parts with no name that says otherwise is not one instrument.
    return (xml.match(/<score-part\b/gi) ?? []).length > 2 ? "other" : "solo-piano";
}
