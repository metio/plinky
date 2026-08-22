// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// How loud a note is for WHERE IT SITS IN THE MUSIC, rather than for where it sits in the
// bar or the phrase.
//
// Two things every pianist does without being asked, and neither of which can be read off a
// position in time — both need to know what the notes actually are.
//
// **Voicing.** A chord is not one sound: the top of the texture is the tune, and the notes
// under it are accompaniment. Played at one level a four-part texture is a block, and the
// melody — the thing a listener is following — is buried in the middle of it. Bringing the
// top out is most of what separates a pianist from a piano roll.
//
// **Contour.** A line that rises is going somewhere, and a player leans into the top of it.
// Played flat, an arch of quavers is a list of pitches; shaped, it is a phrase with a
// destination. This is what the four-bar arch cannot do — that one repeats identically every
// four bars, because it knows nothing about the notes.
//
// Everything here reduces and never lifts. The page sets the ceiling: a note is played at
// the loudness the score asks for or quieter, never louder, so the shaping can never
// contradict a written dynamic.

// How far the inner voices sit under the top one. The bass is ducked less than the middle:
// it is the harmonic floor and a texture with no bottom sounds thin, where an inner voice
// pushing through sounds muddled.
const INNER = 0.1;
const BASS_SHARE = 0.45;

// How much of its loudness a note gives up for being low in its line's local range.
const CONTOUR = 0.09;

// How many positions either side count as "around here" when deciding how high a note sits.
// About a bar and a half of quavers: long enough to have a shape, short enough that the
// shape is local rather than the whole piece flattened into one slope.
const AROUND = 6;

// What one note of a position is played at, relative to the loudest note of it.
//
// `pitches` is every note sounding at this position, including this one. A single note has
// nothing to be voiced against and is played as written.
export function voicingWeight(pitches: readonly number[], pitch: number): number {
    if (pitches.length < 2) {
        return 1;
    }
    const top = Math.max(...pitches);
    const bottom = Math.min(...pitches);
    if (pitch >= top) {
        return 1;
    }
    // The lowest note of the texture is the bass line, not an inner voice.
    return pitch <= bottom ? 1 - INNER * BASS_SHARE : 1 - INNER;
}

// How high each position's top note sits among its neighbours, as a weight per position.
//
// `line` is the top sounding pitch at each position in order, and null where nothing sounds
// — a rest is a hole in the line, not a note at pitch zero, and treating it as one would
// make every note after a rest a peak.
export function contourWeights(line: readonly (number | null)[]): number[] {
    return line.map((pitch, index) => {
        if (pitch === null) {
            return 1;
        }
        const around: number[] = [];
        for (let at = index - AROUND; at <= index + AROUND; at++) {
            const near = line[at];
            if (typeof near === "number") {
                around.push(near);
            }
        }
        const high = Math.max(...around);
        const low = Math.min(...around);
        if (high <= low) {
            // A line going nowhere — a repeated note, a held pedal point — is not shaped.
            // Inventing a swell over it would be shaping the absence of a line.
            return 1;
        }
        const height = (pitch - low) / (high - low);
        return 1 - CONTOUR * (1 - height);
    });
}
