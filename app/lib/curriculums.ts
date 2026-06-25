// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { Score } from "./catalog";
import type { Curriculum } from "./scorePack";

export interface CurriculumGroup {
    curriculum: Curriculum | null; // null collects scores in no known curriculum
    scores: Score[];
}

// Group scores by the curriculums they belong to. A score listing several
// curriculums appears under each; scores in no known curriculum collect under a
// trailing null group. Only curriculums with at least one score are returned.
export function groupByCurriculum(scores: Score[], curriculums: Curriculum[]): CurriculumGroup[] {
    const groups: CurriculumGroup[] = [];
    for (const curriculum of curriculums) {
        const members = scores.filter((score) => score.curriculums?.includes(curriculum.id));
        if (members.length > 0) {
            groups.push({ curriculum, scores: members });
        }
    }
    const known = new Set(curriculums.map((curriculum) => curriculum.id));
    const loose = scores.filter((score) => !score.curriculums?.some((id) => known.has(id)));
    if (loose.length > 0) {
        groups.push({ curriculum: null, scores: loose });
    }
    return groups;
}
