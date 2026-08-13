// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { RecordedNote } from "./composition";
import type { MatchStep } from "./matcher";

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

export function performanceOf(
    steps: readonly MatchStep[],
    { speed = 1, withinMs }: PerformanceOptions = {},
): RecordedNote[] {
    const scale = 1 / Math.max(0.01, speed);
    // The first position anchors the clock: a piece that opens with a rest should not
    // begin with silence in a video that is only seconds long.
    const first = steps[0]?.elapsedMs ?? 0;
    const notes: RecordedNote[] = [];
    for (const step of steps) {
        const startMs = (step.elapsedMs - first) * scale;
        if (withinMs !== undefined && startMs >= withinMs) {
            break;
        }
        for (const [index, pitch] of step.pitches.entries()) {
            // Each key is held for what the score asks of that key, which on a chord of
            // mixed lengths is not one number.
            const holdMs = step.expected?.[index]?.holdMs ?? step.holdMs;
            notes.push({
                pitch,
                startMs,
                durationMs: Math.max(1, holdMs * scale),
                velocity: EVEN_VELOCITY,
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
