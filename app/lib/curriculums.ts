// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { Exercise } from "./exercises";
import type { Curriculum } from "./songPack";

export interface CurriculumGroup {
    curriculum: Curriculum | null; // null collects songs in no known curriculum
    songs: Exercise[];
}

// Group songs by the curriculums they belong to. A song listing several
// curriculums appears under each; songs in no known curriculum collect under a
// trailing null group. Only curriculums with at least one song are returned.
export function groupByCurriculum(songs: Exercise[], curriculums: Curriculum[]): CurriculumGroup[] {
    const groups: CurriculumGroup[] = [];
    for (const curriculum of curriculums) {
        const members = songs.filter((song) => song.curriculums?.includes(curriculum.id));
        if (members.length > 0) {
            groups.push({ curriculum, songs: members });
        }
    }
    const known = new Set(curriculums.map((curriculum) => curriculum.id));
    const loose = songs.filter((song) => !song.curriculums?.some((id) => known.has(id)));
    if (loose.length > 0) {
        groups.push({ curriculum: null, songs: loose });
    }
    return groups;
}
