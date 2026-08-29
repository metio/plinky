// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// How far down a piece reaches when its inner notes come out — measured, once, at bake time.
//
// Held in dev rather than in core because it runs exactly once per score in the catalogue
// and its answer is stored: every visitor reads `reach` out of the manifest, and none of
// them needs the code that produced it. Keeping it here also keeps the difficulty model off
// the path of everything that merely wants to thin a score.

import type { Reach, Reachable } from "../core/reach.ts";
import { REDUCTIONS } from "../core/reduction.ts";
import { categoryOf, gradeOf } from "../core/scoreDifficulty.ts";
import { simplify } from "../core/simplify.ts";
import type { XmlCodec } from "../core/xml.ts";

export const reachOf = (found: readonly Reachable[]): Reach =>
    Object.fromEntries(found.map(({ level, grade }) => [level, grade]));

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
