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
    // Which pedal. The damper is the one scores nearly always mean, and the one the reader
    // used to assume for everything — a sostenuto marking was read as a plain damper span,
    // which holds the whole texture where the score asked for one held chord under a
    // moving line.
    //
    // Absent reads as "sustain", so a span built anywhere else still means what it always
    // did.
    kind?: "sustain" | "sostenuto";
};

// Whether the pedal is down at a printed position. The span is closed where the pedal
// goes down and open where it comes up: a note written at the moment of the press is one
// the pedal is for, and a note written at the moment of the lift is the note the pianist
// lifted for.
export function pedalledAt(spans: readonly PedalSpan[], whole: number): boolean {
    return spans.some(
        (span) =>
            (span.kind ?? "sustain") === "sustain" &&
            whole >= span.from - EPSILON &&
            whole < span.to - EPSILON,
    );
}

// Whether the sostenuto pedal is holding a note struck at `whole` and written to last
// `writtenWholes`.
//
// The middle pedal catches only what is ALREADY sounding when it goes down and holds that
// alone, which is the whole reason it exists: a bass note sustained under a passage played
// dry above it. A note struck after the pedal is down is not caught, and that is the
// difference between it and the damper pedal.
export function sostenutoHolds(
    spans: readonly PedalSpan[],
    whole: number,
    writtenWholes: number,
): PedalSpan | null {
    for (const span of spans) {
        if (span.kind !== "sostenuto") {
            continue;
        }
        // Struck at or before the pedal goes down, and still sounding when it does.
        const sounding = whole + writtenWholes > span.from - EPSILON;
        if (whole <= span.from + EPSILON && sounding && span.to > whole) {
            return span;
        }
    }
    return null;
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
    // The middle pedal holds only what it caught, so it lengthens those notes and nothing
    // else — the point of the marking is that everything struck after it stays dry.
    const caught = sostenutoHolds(spans, whole, writtenWholes);
    return caught ? Math.max(longest, caught.to - whole) : longest;
}

// Printed onsets are exact binary fractions in every ordinary metre, but a triplet is a
// third, so a marking written at one needs room for a rounded value.
const EPSILON = 1e-9;

// Where the score asks for the soft pedal (una corda).
//
// It holds nothing, which is why it is not a PedalSpan: under it the hammers strike fewer
// strings, so notes are gentler and slightly veiled. Written in words rather than as a
// `<pedal>` element, and released by "tre corde".
export type SoftSpan = { from: number; to: number };

// How much of its written loudness a note struck under the soft pedal keeps. A real una
// corda is a change of colour as much as of volume, and only the volume is modelled here —
// so this is deliberately gentle rather than the dramatic drop a bare number suggests.
export const SOFT_SCALE = 0.72;

export function softAt(spans: readonly SoftSpan[], whole: number): boolean {
    return spans.some((span) => whole >= span.from - EPSILON && whole < span.to - EPSILON);
}
