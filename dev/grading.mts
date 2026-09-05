// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The one place a piece's grade is read off its cost, shared by every script that needs
// one — the importer, the title-dedup, and the CI bake-check — so they can never disagree
// about where a grade boundary falls.
//
// The boundaries themselves live in core/scoreDifficulty.ts, where the app reads them too.
// They are fixed numbers calibrated against teaching repertoire by `npm run songs:calibrate`,
// not a cut of whatever has been harvested: a grade has to mean the same thing before and
// after an import, or every import re-grades pieces a player has already worked on.

import { MAX_GRADE, parsePositions, pieceBoundaries } from "../core/scoreDifficulty.ts";
import type { XmlCodec } from "../core/xml.ts";

export { pieceBoundaries };

// The grade of a score in hand, read the way the app's gradeOf reads it: a score with no
// fingerable notes — empty or unreadable — is graded at the top so it cannot pad the
// beginner pools, and everything else off its cost. Baking such a score at grade 1 from
// its cost of 0 put a study in the library at grade 1 that the play page's chip called 8.
export function gradeForScore(
    codec: XmlCodec,
    xml: string,
    cost: number,
    boundaries: number[],
): number {
    const hands = parsePositions(codec, xml);
    if (hands.right.length + hands.left.length === 0) {
        return MAX_GRADE;
    }
    return gradeForCost(cost, boundaries);
}

// Walk the boundaries exactly as the in-app gradeOf does, so the manifest grade and the
// grade chip agree.
export function gradeForCost(cost: number, boundaries: number[]): number {
    let grade = 1;
    for (const boundary of boundaries) {
        if (cost <= boundary) {
            break;
        }
        grade += 1;
    }
    return grade;
}
