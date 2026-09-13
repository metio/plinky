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

import type { Reach, ReductionCosts } from "../core/reach.ts";
import { THINNINGS } from "../core/reduction.ts";
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

// The ways into a piece that is above where somebody is: each reduction that grades easier
// than the piece as written, mildest first, read off the costs dev/measureReach stores.
//
// This is the whole reason a reduction is worth showing rather than hiding behind a toggle.
// A piece two grades out of reach reads as "not yet" and nothing more, when the truth is
// usually that the tune is well within reach and the filling is not. Measuring says so
// exactly — "Grade 5 as written, Grade 2 with the inner notes out" — in the same numbers
// the rest of the app grades in, because it is the same model and the same boundaries.
//
// Where two reductions land on the same grade only the milder is offered: they get you to
// the same place, and the one that takes less out is closer to the piece.
export function reachOf(costs: ReductionCosts, written: number, boundaries: number[]): Reach {
    const reach: Reach = {};
    const seen = new Set<number>();
    for (const level of THINNINGS) {
        const cost = costs[level];
        if (cost === undefined) {
            continue;
        }
        const grade = gradeForCost(cost, boundaries);
        if (grade < written && !seen.has(grade)) {
            seen.add(grade);
            reach[level] = grade;
        }
    }
    return reach;
}
