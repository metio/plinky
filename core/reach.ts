// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// How far down a piece reaches when its inner notes come out.
//
// What the app carries is the shape the catalogue stores and the one question a reader asks
// of it. MEASURING a reduction is a different job and lives in dev/measureReach: it needs
// the whole difficulty model and every score on disk, and it runs once per piece at bake
// time. Shipping that to a browser would be paying, per visitor, for an answer already
// written in the manifest.

import { type Reduction, REDUCTIONS } from "./reduction";

// What a reduction of this piece grades at.
export type Reachable = {
    level: Reduction;
    grade: number;
};

// The same answer as the catalogue stores it: only the reductions that reach somewhere
// easier, so a piece nothing can be taken out of carries nothing.
export type Reach = Partial<Record<Reduction, number>>;

// The easiest way into a piece, and how far down it goes. What a list row shows: one number
// a reader can compare against the grade beside it.
//
// Only the easiest, because a row is answering "can I play this at all" rather than "how
// many ways are there" — the ladder belongs on the piece's own page, where somebody has
// already decided to try.
export function easiestWayIn(reach: Reach | undefined): Reachable | null {
    if (!reach) {
        return null;
    }
    let best: Reachable | null = null;
    for (const level of REDUCTIONS) {
        const grade = reach[level];
        if (grade !== undefined && (best === null || grade < best.grade)) {
            best = { level, grade };
        }
    }
    return best;
}
