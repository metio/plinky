// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// How far down a piece reaches when its inner notes come out.
//
// Kept apart from core/simplify on purpose. The reduction itself is a transform over a
// score and knows nothing about grades; measuring what it comes out at needs the whole
// difficulty model, which reads the fingering, the key, the range and the pace. Holding the
// two together would put the difficulty model behind everything that merely wants to thin a
// score — including the stored preference, which is how this became a circular import the
// moment the two lived in one file.

import { categoryOf, gradeOf } from "./scoreDifficulty";
import { type Reduction, REDUCTIONS } from "./reduction";
import { simplify } from "./simplify";
import type { XmlCodec } from "./xml";

// What a reduction of this piece grades at.
export type Reachable = {
    level: Reduction;
    grade: number;
};

// The same answer as the catalogue stores it: only the reductions that reach somewhere
// easier, so a piece nothing can be taken out of carries nothing.
export type Reach = Partial<Record<Reduction, number>>;

export const reachOf = (found: readonly Reachable[]): Reach =>
    Object.fromEntries(found.map(({ level, grade }) => [level, grade]));

// The easiest way into a piece, and how far down it goes. What a list row shows: one number
// a reader can compare against the grade beside it.
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

// The ways into a piece that is above where somebody is: each reduction that grades easier
// than the score as written, mildest first.
//
// This is the whole reason a reduction is worth showing rather than hiding behind a toggle.
// A piece two grades out of reach reads as "not yet" and nothing more, when the truth is
// usually that the tune is well within reach and the filling is not. Measuring says so
// exactly — "Grade 5 as written, Grade 2 with the inner notes out" — and it says it in the
// same numbers the rest of the app grades in, because it is the same model measuring the
// same way. Nothing here touches what the piece itself is graded at.
//
// Where two reductions land on the same grade only the milder is offered: they get you to
// the same place, and the one that takes less out is closer to the piece.
export function reachableGrades(codec: XmlCodec, id: string, xml: string): Reachable[] {
    // Scales and arpeggios are single lines by construction. There is nothing to thin, and a
    // fingering exercise with notes missing is not an easier exercise but a different one.
    if (categoryOf(id) !== "piece") {
        return [];
    }
    const written = gradeOf(codec, id, xml);
    const found: Reachable[] = [];
    const seen = new Set<number>();
    for (const level of REDUCTIONS) {
        const reduced = simplify(codec, xml, level);
        if (reduced === xml) {
            continue;
        }
        const grade = gradeOf(codec, `${id}~${level}`, reduced);
        if (grade < written && !seen.has(grade)) {
            seen.add(grade);
            found.push({ level, grade });
        }
    }
    return found;
}
