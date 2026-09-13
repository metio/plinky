// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// How far down a piece reaches when its inner notes come out — measured, once, at bake time.
//
// Held in dev rather than in core because it runs exactly once per score in the catalogue
// and its answer is stored: every visitor reads `reach` out of the manifest, and none of
// them needs the code that produced it. Keeping it here also keeps the difficulty model off
// the path of everything that merely wants to thin a score.

import type { ReductionCosts } from "../core/reach.ts";
import { THINNINGS } from "../core/reduction.ts";
import { categoryOf, measureScore } from "../core/scoreDifficulty.ts";
import { simplify } from "../core/simplify.ts";
import type { XmlCodec } from "../core/xml.ts";

// What each reduction of a piece costs, rounded as the manifest stores a cost: the number a
// way-in grade is read off, the way a piece's own grade is read off its `cost`.
//
// Costs rather than grades, so `songs:bake` grades them against the boundaries in the tree
// and a boundary move re-grades the ways in along with the pieces. Only a reduction that
// costs less than the piece as written is kept, since no boundaries can put it lower; and
// only one with notes left to finger, since an empty reduction is graded at the top.
//
// Scales and arpeggios are single lines by construction. There is nothing to thin, and a
// fingering exercise with notes missing is not an easier exercise but a different one.
export function reductionCosts(
    codec: XmlCodec,
    id: string,
    xml: string,
    written: number,
): ReductionCosts {
    if (categoryOf(id) !== "piece") {
        return {};
    }
    const costs: ReductionCosts = {};
    for (const level of THINNINGS) {
        const reduced = simplify(codec, xml, level);
        if (reduced === xml) {
            continue;
        }
        const measured = measureScore(codec, `${id}~${level}`, reduced);
        const cost = Number(measured.cost.toFixed(3));
        if (measured.notes > 0 && cost < written) {
            costs[level] = cost;
        }
    }
    return costs;
}
