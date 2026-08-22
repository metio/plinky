// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { Hit } from "./rhythm";
import { instantaneousBpm, type TempoPoint } from "./tempo";

// The speed a rhythm was actually tapped at, note by note.
//
// The same picture a graded run draws at the end of a piece, for a page that had only a
// verdict: counts of perfect, good and off, and no way to see WHERE the pulse went. A
// steady tap that is uniformly a touch late and a tap that starts well and falls apart
// score alike and are nothing alike, and the graph is what tells them apart.
//
// The reference line is the tempo the trainer is SET to rather than the tapper's own
// median, which is the whole difference from the graded run's version. There the question
// is "did you keep your own pulse"; here a tempo was chosen and displayed before the count-
// in, so the question is "did you keep THAT one", and a line drawn through the middle of a
// steadily-rushed attempt would hide exactly the thing being practised.
export function rhythmTempoPoints(
    // Where each written note falls, in milliseconds at the configured tempo.
    onsets: readonly number[],
    // What was tapped for each written note, index-aligned, null where nothing was.
    hits: readonly (Hit | null)[],
    tempo: number,
): TempoPoint[] {
    const points: TempoPoint[] = [];
    // The last note that was actually tapped, so a gap spans from whatever really sounded
    // rather than from a note nobody played.
    let previous: { index: number; at: number } | null = null;
    for (const [index, onset] of onsets.entries()) {
        const hit = hits[index];
        if (hit === null || hit === undefined) {
            continue;
        }
        const at = onset + hit.deltaMs;
        if (previous !== null) {
            const notated = onset - (onsets[previous.index] as number);
            const actual = at - previous.at;
            if (notated > 0 && actual > 0) {
                points.push({ index, bpm: instantaneousBpm(tempo, notated, actual) });
            }
        }
        previous = { index, at };
    }
    return points;
}
