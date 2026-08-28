// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What a score is written for.
//
// Roughly two thirds of the catalogue is a song with a piano part or a choral setting
// reduced to a grand staff. Both are playable — Plinky opens the piano part and can sound
// the rest as accompaniment — and neither is what a beginner's grade should be built
// from. Recording which is which is what lets the ladder ask for piano writing while the
// library keeps everything.
//
// Decided at import (dev/scoreInstrument reads it from the file, or the source says so
// outright) and carried on the manifest row, because a choral reduction drops its vocal
// part names on the way and nothing in the file it produces says it was ever choral.
export type ScoreKind =
    // Keyboard alone: what a beginner is graded on.
    | "solo-piano"
    // A singer over a piano part.
    | "voice-and-piano"
    // Vocal parts reduced onto a grand staff.
    | "choral-reduction"
    // An ensemble, or a transcription for another instrument.
    | "other";
