// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Where the score asks for the sustain pedal.
//
// A pedal marking changes what the written note lengths mean. Under the pedal the sound
// is held by the damper rather than by the fingers, and a pianist plays exactly that way:
// keys are released early, often long before the note's written value is up, because the
// pedal is carrying it. So a passage read as if the pedal were not there has a player
// doing the right thing and looking, to the app, like someone chopping every note short.
//
// It also changes how a piece sounds. Playing a pedalled passage dry — each note stopping
// at its own written length — is not the piece; the whole point of the marking is that
// the harmony pools.

export type PedalSpan = {
    // Whole notes from the top of the piece: where the pedal goes down, and where it
    // comes up.
    from: number;
    to: number;
};

// Whether the pedal is down at a printed position. The span is closed where the pedal
// goes down and open where it comes up: a note written at the moment of the press is one
// the pedal is for, and a note written at the moment of the lift is the note the pianist
// lifted for.
export function pedalledAt(spans: readonly PedalSpan[], whole: number): boolean {
    return spans.some((span) => whole >= span.from - EPSILON && whole < span.to - EPSILON);
}

// How long a note struck at `whole` keeps sounding, in whole notes: its own written
// length, or however much longer the pedal holds it. A note outside any pedal span keeps
// exactly the length it was written with.
export function ringUntil(
    spans: readonly PedalSpan[],
    whole: number,
    writtenWholes: number,
): number {
    let longest = writtenWholes;
    for (const span of spans) {
        if (pedalledAt([span], whole)) {
            longest = Math.max(longest, span.to - whole);
        }
    }
    return longest;
}

// Printed onsets are exact binary fractions in every ordinary metre, but a triplet is a
// third, so a marking written at one needs room for a rounded value.
const EPSILON = 1e-9;
