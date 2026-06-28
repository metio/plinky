// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// The one place the piece-grade octiles are computed, shared by every script that
// touches them — the importer, the title-dedup, and the CI bake-check — so they can
// never disagree about where a grade boundary falls.

// The MAX_GRADE-1 even octile cost boundaries: sort the costs and read the cost at
// each k/MAX_GRADE cut, so the corpus splits into MAX_GRADE equally-sized grade bins.
// Rounded to 3 dp to match the values baked into GRADE_THRESHOLDS.piece.
export function octileBoundaries(costs: number[], maxGrade: number): number[] {
    const sorted = [...costs].sort((a, b) => a - b);
    const boundaries: number[] = [];
    for (let grade = 1; grade < maxGrade; grade++) {
        boundaries.push(
            Number((sorted[Math.floor((grade * sorted.length) / maxGrade)] ?? 0).toFixed(3)),
        );
    }
    return boundaries;
}

// Walk the boundaries exactly as the in-app gradeOf does, so the manifest grade and
// the grade chip agree once the boundaries are baked into GRADE_THRESHOLDS.piece.
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
