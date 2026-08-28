// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Corpus titles arrive from other people's exports, and some of them have been through a
// wrong decoding on the way: text written in one encoding read as another, which turns a
// line of Arabic or Cyrillic into a run of "ÙØ¹ ØªØ" that nobody can read.
//
// Where the damage is reversible — the classic UTF-8-read-as-Latin-1, every byte intact —
// the bytes are put back. Where it is not, the unreadable runs are dropped rather than
// shown: a title promises to name the piece, and a row of rubble keeps none of that.

// What a wrong decoding actually looks like: a UTF-8 lead byte (0xC0-0xFF, which reads as
// a Latin-1 capital) followed by its continuation bytes (0x80-0xBF, which read as the
// punctuation and control block). No language writes an accented letter followed by "¹"
// or "ª", while every character of a wrong decoding is exactly that — which is why Šárka, Ærø and
// Für survive this and "ÙØ¹ ØªØ" does not. Damaged text also loses whole bytes, so a
// stranded run of leads beside a matched one goes with it.
const DAMAGE = "(?:[\\u00C0-\\u00FF]+[\\u0080-\\u00BF]+)+[\\u00C0-\\u00FF]*";
const RUNS = new RegExp(DAMAGE, "g");
// A separate, non-global copy: `test` on a /g regex carries lastIndex from call to call.
const HAS_RUN = new RegExp(DAMAGE);
const ANY_HIGH = /[\u0080-\uFFFF]/;

// A whole word of nothing but those characters, which is what is left where every
// continuation byte was lost. Two or more, so a Danish "Ø" or a French "à" standing alone
// is left alone.
const RUBBLE_WORD = /^[\u0080-\u00FF]{2,}$/;

// Undo a UTF-8 string that was read as Latin-1. Null when the round trip does not produce
// valid UTF-8 — which is how an ordinary accented title, or one whose bytes were already
// lost, declines the repair.
function repaired(text: string): string | null {
    if (Array.from(text).some((char) => char.charCodeAt(0) > 0xff)) {
        return null;
    }
    try {
        return new TextDecoder("utf-8", { fatal: true }).decode(
            Uint8Array.from(text, (char) => char.charCodeAt(0)),
        );
    } catch {
        return null;
    }
}

export function legibleTitle(raw: string): string {
    const text = (raw ?? "").replace(/\s+/g, " ").trim();
    if (!ANY_HIGH.test(text)) {
        return text;
    }
    const whole = repaired(text);
    if (whole !== null && !HAS_RUN.test(whole)) {
        return whole.replace(/\s+/g, " ").trim();
    }
    // Beyond repair: drop the damaged runs and keep whatever stood around them, so
    // "Beethoven SilenceÙØ¹ ØªØ" still names the piece it came from.
    return text
        .replace(RUNS, " ")
        .split(" ")
        .filter((word) => word !== "" && !RUBBLE_WORD.test(word))
        .join(" ")
        .trim();
}

// The text a notation program leaves in the box when nobody filled it in. MuseScore
// writes "Title" and "Composer" into every new score, and an export that was never named
// carries them through to the catalogue — where they read as a piece actually called
// "Untitled", 178 of which had shipped.
//
// Distinct from legibleTitle above: that one repairs text that was mangled in transit.
// This one is about text that was never written.
const PLACEHOLDER =
    /^(untitled(\s+score)?|title|score|composer|subtitle|new\s+score|piece|movement|none|n\/?a)$/i;

// The first of these that actually names something, or "" when none of them do. The
// MusicXML is asked first and the harvest metadata second: the file is the authority when
// it says anything, and the row that pointed at it is the fallback when it does not.
export function usableTitle(...candidates: (string | undefined)[]): string {
    for (const candidate of candidates) {
        const text = legibleTitle(candidate ?? "").trim();
        if (text !== "" && !PLACEHOLDER.test(text)) {
            return text;
        }
    }
    return "";
}
