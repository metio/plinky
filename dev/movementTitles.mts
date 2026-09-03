// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Which line of a score's engraved credit names the movement, where the title field does
// not.
//
// A corpus exports a suite as one row per movement and gives every row the title of the
// whole work: six "French Suite no. 5 in G major", seven "Prelude", five "1. Berceuse
// (Lullaby)". The movement is usually printed on the page all the same — engraved above
// the first system, and carried into MusicXML as <credit-words> — so the score can be asked
// what it says about itself.
//
// This proposes, it does not decide. What a piece should be CALLED, given that its score
// prints "III. Clair de Lune" under a work title of "Suite bergamasque", is a judgement
// about how a catalogue reads, and judgements go in dev/catalog-curation.json where each
// one is written down with a reason. The rules here only find the candidate line, which is
// the part that is mechanical and the part nobody should do by hand across a hundred
// scores.

import { canonicalComposer } from "../core/person.ts";

// A credit line that names nobody and nothing: an engraver's rule, a separator, an
// editorial note.
const NOISE = /^[-–—_.\s]*$/;
// Arrangement and edition notes. They sit in the same credit block and name the wrong
// person: "Arr. for piano 4 hands by | Theodor Kirchner" is two lines about an arranger.
const APPARATUS = /\b(arr\.|arrange|transcription|transcribed|edit(ed|ion)?|ed\.|rev\.|urtext|copyright|©)/i;
// A life span standing on its own — "c. 1802 – c. 1880" — printed under a composer's name.
const DATES = /^\(?\s*(c\.?\s*)?\d{3,4}\s*[-–—~]\s*(c\.?\s*)?\d{3,4}\s*\)?$/;

// Punctuation and case removed, so "Suite Bergamasque" and "Suite bergamasque" are one
// string and a credit repeating the title can be recognised as repeating it.
function bare(text: string): string {
    return text
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "");
}

// Whether a line carries an identifying number: a movement number ("1.", "IV."), a
// catalogue number ("K. 35", "BWV 816"), or an opus and number ("Op. 28 No. 7"). It is the
// strongest signal a line distinguishes this score from its siblings, and the weakest thing
// a tempo marking or a dedication ever has.
const NUMBERED = /(^|\s)(\d+\s*[.):]|[IVXLC]+\s*[.)]|(op|no|nr|k|bwv|hob|d|kv)\.?\s*\d)/i;

export type MovementCandidate = {
    // The credit line itself, exactly as the score prints it.
    line: string;
    // Whether it carries a number, which is what makes it worth proposing at all.
    numbered: boolean;
};

// The credit lines that could name this movement: everything the score prints except its
// own work title, its composer, and the apparatus around them.
//
// Ordered numbered-first, because a score that prints both "Andantino" and "Op. 28 No. 7"
// is telling you the tempo and telling you which prelude, and only one of those tells it
// from the six beside it.
export function movementCandidates(
    creditLines: readonly string[],
    title: string,
    composer: string,
): MovementCandidate[] {
    const titleKey = bare(title);
    const composerKey = bare(canonicalComposer(composer));
    const seen = new Set<string>();
    const candidates: MovementCandidate[] = [];
    for (const raw of creditLines) {
        const line = raw.replace(/\s+/g, " ").trim();
        const key = bare(line);
        if (key === "" || NOISE.test(line) || DATES.test(line) || APPARATUS.test(line)) {
            continue;
        }
        // The work title, or the composer under any of the spellings the alias table knows.
        if (
            key === titleKey ||
            key === composerKey ||
            bare(canonicalComposer(line)) === composerKey
        ) {
            continue;
        }
        if (seen.has(key)) {
            continue;
        }
        seen.add(key);
        candidates.push({ line, numbered: NUMBERED.test(line) });
    }
    return [...candidates].sort((a, b) => Number(b.numbered) - Number(a.numbered));
}
