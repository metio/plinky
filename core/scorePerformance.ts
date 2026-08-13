// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { DEFAULT_SPLIT_POINT, type RecordedNote } from "./composition";
import { fingerPositions } from "./fingering";
import type { Hand2, MatchStep } from "./matcher";

// A score played exactly as written, as a performance.
//
// Everything that renders a video — the scene painter, the offline audio render — takes
// RecordedNote[], because a video is of something somebody played. A catalogue piece has
// nobody's playing behind it, so there is nothing to render until the score itself is
// turned into a performance: every note struck on time, held for its written length, at
// an even touch.
//
// The step model already carries what that needs. Since repeats, tempo marks and fermatas
// were folded into it, `elapsedMs` is where a position genuinely falls in time and
// `holdMs` how long it should ring, both at the tempi the score writes — so this is a
// change of shape, not a second interpretation of the music.

// A steady touch. Loud enough to sound present, short of the ceiling so an accented note
// in an expressive score still has somewhere to go.
export const EVEN_VELOCITY = 88;

export type PerformanceOptions = {
    // Play the whole piece faster or slower than written; 1 is as written.
    speed?: number;
    // Keep only what sounds within this many milliseconds of the start — for a clip of a
    // piece rather than the whole of it. The cut lands on a position boundary, so the
    // performance never ends halfway into a chord.
    withinMs?: number;
};

// The fingering the piece would be played with, per hand, as a lookup from
// (hand, position index) to that position's fingers. Each hand's line is fingered as one
// sequence — the cost model reads a hand's own previous position to decide where the hand
// travels, so the two hands must not be interleaved into one call.
function fingeringOf(steps: readonly MatchStep[]): Map<Hand2, number[][]> {
    const positions: Record<Hand2, number[][]> = { left: [], right: [] };
    for (const step of steps) {
        const byHand: Record<Hand2, number[]> = { left: [], right: [] };
        for (const [index, pitch] of step.pitches.entries()) {
            byHand[step.pitchHands[index] ?? "right"].push(pitch);
        }
        // Every step contributes a position to both hands, empty where that hand is
        // silent, so the index a note is looked up by is the step's own index.
        positions.left.push(byHand.left);
        positions.right.push(byHand.right);
    }
    return new Map([
        ["left", fingerPositions(positions.left, "left")],
        ["right", fingerPositions(positions.right, "right")],
    ]);
}

export function performanceOf(
    steps: readonly MatchStep[],
    { speed = 1, withinMs }: PerformanceOptions = {},
): RecordedNote[] {
    const scale = 1 / Math.max(0.01, speed);
    // The first position anchors the clock: a piece that opens with a rest should not
    // begin with silence in a video that is only seconds long.
    const first = steps[0]?.elapsedMs ?? 0;
    const notes: RecordedNote[] = [];
    const fingering = fingeringOf(steps);
    // How many of each hand's notes in this step have been handed a finger already, so a
    // chord's members take their fingers in the order the hand's position lists them.
    for (const [stepIndex, step] of steps.entries()) {
        const taken: Record<Hand2, number> = { left: 0, right: 0 };
        const startMs = (step.elapsedMs - first) * scale;
        if (withinMs !== undefined && startMs >= withinMs) {
            break;
        }
        for (const [index, pitch] of step.pitches.entries()) {
            // Each key is held for what the score asks of that key, which on a chord of
            // mixed lengths is not one number.
            const holdMs = step.expected?.[index]?.holdMs ?? step.holdMs;
            const hand = step.pitchHands[index] ?? "right";
            const finger = fingering.get(hand)?.[stepIndex]?.[taken[hand]];
            taken[hand] += 1;
            notes.push({
                pitch,
                startMs,
                durationMs: Math.max(1, holdMs * scale),
                velocity: EVEN_VELOCITY,
                hand,
                ...(finger === undefined ? {} : { finger }),
            });
        }
    }
    return notes;
}

// How long a performance lasts: to the end of the last note still sounding, not to the
// last onset, so a video does not cut off the final chord.
export function performanceLengthMs(notes: readonly RecordedNote[]): number {
    let end = 0;
    for (const note of notes) {
        end = Math.max(end, note.startMs + note.durationMs);
    }
    return end;
}

// Fingering for a performance nobody wrote down: a recorded take. There is no score to
// read a hand off, so the notes are split at the same point the sketch staff splits at,
// simultaneous onsets are gathered into positions, and each hand's line goes through the
// same cost model a score's would. This is a guess about the hands and an answer about
// the fingers — good enough to colour by, and never shown as advice.
//
// Notes that already carry a finger are left alone, so a score-derived performance is
// never re-fingered from its own output.
export function fingeredFreely(notes: readonly RecordedNote[]): RecordedNote[] {
    if (notes.length === 0 || notes.some((note) => note.finger !== undefined)) {
        return [...notes];
    }
    const sorted = [...notes].sort((a, b) => a.startMs - b.startMs);
    const positions: Record<Hand2, number[][]> = { left: [], right: [] };
    // Where each note ends up: the hand it was given and its slot in that position.
    const placed = new Map<RecordedNote, { hand: Hand2; index: number; position: number }>();
    let onset = Number.NaN;
    for (const note of sorted) {
        if (note.startMs !== onset) {
            onset = note.startMs;
            positions.left.push([]);
            positions.right.push([]);
        }
        const hand: Hand2 = note.pitch < DEFAULT_SPLIT_POINT ? "left" : "right";
        const bucket = positions[hand];
        placed.set(note, {
            hand,
            index: bucket[bucket.length - 1]!.length,
            position: bucket.length - 1,
        });
        bucket[bucket.length - 1]!.push(note.pitch);
    }
    const fingering: Record<Hand2, number[][]> = {
        left: fingerPositions(positions.left, "left"),
        right: fingerPositions(positions.right, "right"),
    };
    return sorted.map((note) => {
        const at = placed.get(note)!;
        const finger = fingering[at.hand][at.position]?.[at.index];
        return { ...note, hand: at.hand, ...(finger === undefined ? {} : { finger }) };
    });
}
