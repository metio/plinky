// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Which staves of a score are the piano, and which belong to something else.
//
// A grand staff is not always the whole score. 70% of the catalogue is written for more
// than one instrument, and the dominant shape by far — nearly nine in ten of those — is
// an art song: a vocal line on one staff, then the piano on two. The engraver numbers
// staves across the WHOLE sheet, so on such a score the piano's right hand is staff 1
// and its left is staff 2, while staff 0 is the singer.
//
// Assuming the treble is always staff 0 therefore hands the player the sung melody when
// they ask for the right hand, the piano's right hand when they ask for the left, and
// leaves the piano's left hand unreachable by any mode. This works the mapping out from
// the score instead.

export type ScoreParts = {
    // Global staff index of the practised instrument's upper staff…
    right: number;
    // …and its lower one. May name a staff the score does not have, for an instrument
    // written on a single staff: nothing matches it, so hands-separate practice of the
    // left hand finds nothing to play, which is the honest answer.
    left: number;
    // Every other staff — the singer, a second instrument. Never demanded of the player;
    // Plinky can sound them as accompaniment, and hides them unless asked.
    other: number[];
};

// The staves belong to the LAST part that has two of them. Piano is written last in
// vocal and chamber scores by convention, and two staves is what makes a part a keyboard
// part. A score with no such part falls back to its last part, which for a single-part
// score is the whole thing and reproduces the plain grand-staff case exactly.
export function partsOf(stavesPerPart: readonly number[]): ScoreParts {
    const counts = stavesPerPart.filter((count) => Number.isInteger(count) && count > 0);
    if (counts.length === 0) {
        return { right: 0, left: 1, other: [] };
    }

    const offsets: number[] = [];
    let running = 0;
    for (const count of counts) {
        offsets.push(running);
        running += count;
    }

    let chosen = counts.length - 1;
    for (const [index, count] of counts.entries()) {
        if (count >= 2) {
            chosen = index;
        }
    }

    const right = offsets[chosen] as number;
    const left = right + 1;
    const other: number[] = [];
    for (let staff = 0; staff < running; staff++) {
        if (staff !== right && staff !== left) {
            other.push(staff);
        }
    }
    return { right, left, other };
}

// The plain grand staff, for the callers that have no score to read — a generated drill,
// a test, anything built rather than engraved.
export const GRAND_STAFF: ScoreParts = { right: 0, left: 1, other: [] };

// Whether a staff is one the player is being asked to read at all. The accompaniment
// staves are the score's, not the player's.
export function isPlayedStaff(staff: number | undefined, parts: ScoreParts): boolean {
    return staff === parts.right || staff === parts.left;
}
