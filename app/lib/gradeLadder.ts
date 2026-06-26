// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { loadHistory } from "./history";
import { loadAllMastery } from "./mastery";

// Plinky's own progression ladder, structured like the familiar 8-grade exam
// path: you climb by building scales, arpeggios, and pieces together (and by
// turning up to practise), not by any single thing. It is deliberately not an
// official grade — just a target to work toward, level by level.

export type LadderProgress = {
    scales: number; // scales marked learned
    arpeggios: number; // arpeggios marked learned
    pieces: number; // other pieces marked learned
    days: number; // distinct days practised
};

// Cumulative requirements per level. You are at the highest level whose every
// requirement — and every level below it — is met. Tuned to be reachable with the
// bundled scales/arpeggios, with pieces (importable) gating the upper grades.
export const LEVELS: Partial<LadderProgress>[] = [
    { days: 1 }, // 1 — turned up
    { scales: 1 }, // 2
    { scales: 3 }, // 3
    { scales: 5, arpeggios: 1 }, // 4
    { scales: 8, arpeggios: 3, pieces: 1 }, // 5
    { scales: 12, arpeggios: 6, pieces: 1 }, // 6
    { scales: 15, arpeggios: 10, pieces: 2 }, // 7
    { scales: 15, arpeggios: 15, pieces: 3 }, // 8
];

export const MAX_LEVEL = LEVELS.length;

function meets(progress: LadderProgress, requirement: Partial<LadderProgress>): boolean {
    return (Object.keys(requirement) as (keyof LadderProgress)[]).every(
        (key) => progress[key] >= (requirement[key] ?? 0),
    );
}

// The grade reached: the count of consecutive levels satisfied from the bottom
// (requirements grow with level, so the first unmet one caps the grade).
export function levelFor(progress: LadderProgress): number {
    let level = 0;
    for (const requirement of LEVELS) {
        if (!meets(progress, requirement)) {
            break;
        }
        level += 1;
    }
    return level;
}

// The next grade and what's still missing for it, or null once the top is reached.
export function nextLevel(
    progress: LadderProgress,
): { level: number; requirement: Partial<LadderProgress> } | null {
    const level = levelFor(progress);
    if (level >= MAX_LEVEL) {
        return null;
    }
    return { level: level + 1, requirement: LEVELS[level]! };
}

// Reads the player's progress from their mastery and practice history. Scales and
// arpeggios are recognised by their catalogue id prefix; everything else learned
// counts as a piece.
export function measureProgress(): LadderProgress {
    const learned = loadAllMastery().filter((entry) => entry.mastery.learned);
    const scales = learned.filter((entry) => entry.id.startsWith("scale-")).length;
    const arpeggios = learned.filter((entry) => entry.id.startsWith("arpeggio-")).length;
    return {
        scales,
        arpeggios,
        pieces: learned.length - scales - arpeggios,
        days: Object.values(loadHistory()).filter((notes) => notes > 0).length,
    };
}
