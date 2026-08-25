// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The scale a piece is built from, offered before you play it.
//
// A piece in E♭ major is three flats a hand has to find without looking. Playing the E♭
// scale once first is what a teacher would ask for, and it is the oldest piece of piano
// pedagogy there is: the skill in isolation, then the same skill in real music, minutes
// apart. What makes it worth building rather than assuming is that Plinky knows the key
// exactly — the score is parsed on the way in, so this is read rather than guessed.
//
// It is an offer and never a requirement. Gating the piece behind the scale is the shape
// the course apps use and the shape this app refuses: skipping it costs nothing, and the
// pedagogy survives the removal where the pressure does not.
//
// Pure: a key signature in, an exercise out. No catalogue, no store, no clock.

import type { ExerciseConfig } from "./exerciseGen";
import { keySlugFor } from "./exerciseGen";

export type WarmUp = {
    // The exercise to play, ready for buildExerciseId.
    exercise: ExerciseConfig;
    // The key slug, for keyName() — the copy says which key it is about to teach.
    key: string;
    // How many sharps or flats the hand has to place, always positive. The whole reason
    // the offer is worth making, and the number the sentence is built around.
    accidentals: number;
};

// Both hands, one octave: the shape a warm-up wants. Two octaves is a practice session
// rather than the minute this is asking for, and one hand leaves the other cold.
const SHAPE = { octaves: 1, hands: "both", inversion: 0, interval: "single" } as const;

// What to play before this piece, or null when there is nothing honest to offer.
//
// Null in three cases, each on purpose. A signature outside the twelve keys the exercises
// ship, because answering six sharps with the wrong scale teaches the wrong thing. A piece
// that IS an exercise, because a scale before a scale is a loop rather than a lesson. And
// a piece with no key at all, which is what an unparsed or atonal score reads as.
export function warmUpFor(input: {
    // Sharps positive, flats negative, exactly as a score writes it.
    fifths: number;
    minor: boolean;
    // Whether the piece is itself a generated exercise or study.
    isExercise: boolean;
}): WarmUp | null {
    if (input.isExercise) {
        return null;
    }
    const key = keySlugFor(input.fifths, input.minor);
    if (key === null) {
        return null;
    }
    return {
        key,
        accidentals: Math.abs(input.fifths),
        exercise: {
            ...SHAPE,
            // The minor scale a player is taught first, and the one the key signature
            // actually writes: the harmonic minor raises its seventh with an accidental
            // rather than in the signature, so the natural form is what the printed key
            // says. The piece may well use the harmonic form; the signature does not.
            type: input.minor ? "natural-minor-scale" : "major-scale",
            key,
        },
    };
}
