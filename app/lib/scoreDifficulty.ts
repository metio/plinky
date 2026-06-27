// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { fingerPositions, positionsCost } from "./fingering";

// How hard a score is to *play*, derived from the fingering cost model — the same
// piano-ergonomics engine behind the fingering trainer. Each hand's notes are
// worked into their optimal fingering and the per-note effort averaged; that
// scalar maps onto a 1–8 grade, calibrated per content category so the hardest
// finger exercise sits at the top of its own scale rather than at the bottom of
// the pieces' scale.

const STEP_SEMITONES: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

function midiOf(note: Element): number | null {
    const pitch = note.querySelector("pitch");
    if (!pitch) {
        return null; // a rest, or an unpitched note — nothing to finger
    }
    const step = pitch.querySelector("step")?.textContent?.trim() ?? "";
    const semitone = STEP_SEMITONES[step];
    if (semitone === undefined) {
        return null;
    }
    const octave = Number(pitch.querySelector("octave")?.textContent ?? "4");
    const alter = Number(pitch.querySelector("alter")?.textContent ?? "0");
    return (octave + 1) * 12 + semitone + alter;
}

// Split a score's notes into the two hands' position sequences (a position is a
// chord, or a single note). Staff 1 is the right hand, staff 2 the left; a note
// with <chord/> joins the hand's current position instead of starting a new one.
export function parsePositions(xml: string): { right: number[][]; left: number[][] } {
    const right: number[][] = [];
    const left: number[][] = [];
    let document: Document;
    try {
        document = new DOMParser().parseFromString(xml, "application/xml");
    } catch {
        return { right, left };
    }
    if (document.querySelector("parsererror")) {
        return { right, left };
    }
    for (const note of document.querySelectorAll("note")) {
        const midi = midiOf(note);
        if (midi === null) {
            continue;
        }
        const hand = note.querySelector("staff")?.textContent?.trim() === "2" ? left : right;
        if (note.querySelector("chord") && hand.length > 0) {
            hand[hand.length - 1]!.push(midi);
        } else {
            hand.push([midi]);
        }
    }
    return { right, left };
}

function handEffort(positions: number[][], hand: "left" | "right"): number {
    if (positions.length === 0) {
        return 0;
    }
    return positionsCost(positions, fingerPositions(positions, hand), hand);
}

// The score's raw playing effort: total fingering cost across both hands, averaged
// over every note — so length doesn't inflate it and a short hard piece outranks a
// long easy one.
export function rawDifficulty(xml: string): number {
    const { right, left } = parsePositions(xml);
    const notes = right.length + left.length;
    if (notes === 0) {
        return 0;
    }
    return (handEffort(right, "right") + handEffort(left, "left")) / notes;
}

export type Category = "scale" | "arpeggio" | "piece";

// Scales and arpeggios are recognised by their catalogue id prefix; everything
// else is a piece.
export function categoryOf(id: string): Category {
    if (id.startsWith("scale-")) {
        return "scale";
    }
    if (id.startsWith("arpeggio-")) {
        return "arpeggio";
    }
    return "piece";
}

export const MAX_GRADE = 8;

// The cost breakpoints between grades 1–8, calibrated PER category so each is
// graded on its own scale — otherwise every finger exercise lands below the
// easiest piece (scales/arpeggios cost more to finger than a stepwise tune). The
// `piece` breakpoints are the octiles of the curated PDMX song corpus (≈3,100
// pieces), so real pieces spread evenly across grades 1–8; re-derive them with
// `npm run songs:import` if the corpus changes. Scale/arpeggio remain measured
// against the beginner exercises (scales ~0.6–1.1, arpeggios ~1.3–1.8).
const GRADE_THRESHOLDS: Record<Category, number[]> = {
    piece: [0.543, 0.941, 1.569, 2.401, 3.294, 4.339, 6.013],
    scale: [0.8, 1.0, 1.2, 1.5, 1.8, 2.1, 2.4],
    arpeggio: [1.4, 1.6, 1.9, 2.2, 2.5, 2.8, 3.1],
};

const gradeCache = new Map<string, number>();

// A score's 1–8 grade: its fingering-cost difficulty placed against its category's
// thresholds. Memoised by id, since a score's notes don't change.
export function gradeOf(id: string, xml: string): number {
    const cached = gradeCache.get(id);
    if (cached !== undefined) {
        return cached;
    }
    const cost = rawDifficulty(xml);
    let grade = 1;
    for (const threshold of GRADE_THRESHOLDS[categoryOf(id)]) {
        if (cost <= threshold) {
            break;
        }
        grade += 1;
    }
    gradeCache.set(id, grade);
    return grade;
}
