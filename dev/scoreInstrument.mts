// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// Decides whether a MusicXML score belongs in a *piano* catalogue. Shared by the
// import pipeline (to reject non-piano scores up front) and the catalogue audit (to
// flag ones that slipped in). Conservative by design: only a confident non-piano
// signal flags a score, so a real keyboard piece is never dropped.

const KEYBOARD = /piano|keyboard|klavier|clavier|harpsichord|clavichord|celesta|organ/;
const OTHER_INSTRUMENT =
    /drum|percussion|cymbal|guitar|\bbass\b|violin|cello|viola|contrabass|flute|trumpet|saxophone|\bsax\b|clarinet|oboe|bassoon|trombone|tuba|\bhorn\b|choir|\bvoice\b|vocal|ukulele|banjo|mandolin|\bharp\b|recorder|piccolo|accordion|\bsynth/;

// Non-keyboard melodic/percussion instruments, for the piano-OR-vocal gate below.
// "bass" alone stays out (it's a voice part in art song); a real double bass reads as
// "contrabass" / "double bass".
const INSTRUMENTAL =
    /drum|percussion|cymbal|guitar|violin|cello|viola|contrabass|double.?bass|flute|trumpet|saxophone|\bsax\b|clarinet|oboe|bassoon|trombone|tuba|\bhorn\b|ukulele|banjo|mandolin|\bharp\b|recorder|piccolo|accordion|\bsynth|string|brass|orchestr/;

// Returns the disqualifying reason, or null when the score is a (probable) piano piece.
export function nonPianoReason(xml: string): string | null {
    // Unpitched notes / a percussion clef are unambiguous — a drum kit, not a piano.
    if (/<sign>\s*percussion\s*<\/sign>/i.test(xml) || /<unpitched\b/i.test(xml)) {
        return "percussion";
    }
    const names = [
        ...xml.matchAll(
            /<(?:part-name|instrument-name)[^>]*>([^<]*)<\/(?:part-name|instrument-name)>/gi,
        ),
    ]
        .map((match) => match[1]!.trim().toLowerCase())
        .join(" | ");
    // A clearly-named other instrument with no keyboard part anywhere.
    if (!KEYBOARD.test(names) && OTHER_INSTRUMENT.test(names)) {
        return "named-instrument";
    }
    return null;
}

function instrumentNames(xml: string): string {
    return [
        ...xml.matchAll(
            /<(?:part-name|instrument-name)[^>]*>([^<]*)<\/(?:part-name|instrument-name)>/gi,
        ),
    ]
        .map((match) => match[1]!.trim().toLowerCase())
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
