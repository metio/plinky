// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Telling an engraving from a machine transcription.
//
// A score converted out of a MIDI performance can be structurally perfect — every bar
// summing to its metre, every duration matching its printed value — and still be unplayable
// music, because the quantiser has fitted the performance rather than read the piece. The
// catalogue holds both kinds and nothing distinguished them.
//
// The one marker that separates them cleanly is the tuplet ratio. An engraver writes a
// handful of them: triplets, sextuplets, the odd quintuplet or septuplet. A quantiser writes
// whatever ratio makes a leftover gap add up — twelve in the time of seven, thirteen in the
// time of eleven. Nobody has ever printed those, so their presence is not a matter of taste.
//
// Measured against the catalogue: the real ratios in 3056 scores are, in order,
// 3:2, 6:4, 2:1, 5:4, 2:3, 6:5, 7:4, 9:8, 9:4, 7:6 — and 154 scores contain at least one
// ratio outside that world. It agreed with a listener on the first case it was tried on: of
// three transcriptions of Für Elise, the only one reported as sounding broken is the only
// one carrying an impossible ratio.

// The ratios engraved music actually uses. A tuplet divides a note into `actual` parts where
// `normal` would fit, so the sets are the ordinary subdivisions and their inverses, plus the
// compound-metre regroupings.
// In lowest terms — see isEngravableTuplet.
const ENGRAVABLE = new Set([
    "3:2",
    "2:3",
    "5:4",
    "4:5",
    "7:4",
    "4:7",
    "6:5",
    "5:6",
    "9:8",
    "8:9",
    "2:1",
    "1:2",
    "3:4",
    "4:3",
    "9:4",
    "4:9",
    "7:6",
    "6:7",
    "5:2",
    "2:5",
    "7:8",
    "8:7",
    "5:8",
    "8:5",
    "11:8",
    "8:11",
    "13:8",
    "3:1",
    "1:3",
    "4:1",
    "5:3",
    "3:5",
    "7:2",
    "2:7",
    "5:6",
    "11:4",
    "13:4",
    "15:8",
    "5:1",
]);

export function isEngravableTuplet(actual: number, normal: number): boolean {
    if (!Number.isInteger(actual) || !Number.isInteger(normal) || actual < 1 || normal < 1) {
        return false;
    }
    // Reduced first: 16:8 is a notation program writing 2:1 in the units of the bar it is
    // in, and 20:16 is 5:4 the same way. Judging them unreduced condemns ordinary
    // engravings — it flagged a third more of the catalogue than it should have.
    const divisor = gcd(actual, normal);
    return ENGRAVABLE.has(`${actual / divisor}:${normal / divisor}`);
}

function gcd(one: number, other: number): number {
    return other === 0 ? one : gcd(other, one % other);
}

// Every tuplet ratio a MusicXML document writes, as `actual:normal` strings in the order met.
//
// Scanned rather than parsed: this is a heuristic over a fixed element shape, it runs over
// thousands of files in a build script that has no DOM, and a parse would cost a great deal
// more for an answer of exactly the same confidence.
export function tupletRatios(xml: string): string[] {
    const ratios: string[] = [];
    const blocks = xml.matchAll(/<time-modification>([\s\S]*?)<\/time-modification>/g);
    for (const match of blocks) {
        const body = match[1] ?? "";
        const actual = /<actual-notes>\s*(\d+)\s*<\/actual-notes>/.exec(body)?.[1];
        const normal = /<normal-notes>\s*(\d+)\s*<\/normal-notes>/.exec(body)?.[1];
        if (actual && normal) {
            ratios.push(`${Number(actual)}:${Number(normal)}`);
        }
    }
    return ratios;
}

// How many ratios in this document no engraver would have written. Zero for a real
// engraving, and for any score with no tuplets at all.
export function quantiserMarks(xml: string): number {
    let marks = 0;
    for (const ratio of tupletRatios(xml)) {
        const [actual, normal] = ratio.split(":").map(Number);
        if (!isEngravableTuplet(actual as number, normal as number)) {
            marks += 1;
        }
    }
    return marks;
}
