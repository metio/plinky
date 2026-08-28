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

import { pieceBoundaries } from "../core/scoreDifficulty.ts";

export { pieceBoundaries };

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
