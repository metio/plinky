// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// A playable song. ABC bodies are monophonic-per-step with whole-bar grouping,
// so each rendered note maps to exactly one playable step; the trainer advances
// one expected note at a time, deriving the target pitch from abcjs itself.
// Songs live in local storage (seeded from the registry on first run, or
// imported), never bundled into the app.
export type Exercise = {
    id: string;
    title: string;
    description: string;
    abc: string;
    tempo: number; // beats per minute for the metronome and count-in
    beatsPerBar: number; // matches the ABC meter, so the count-in fills one bar
    curriculums?: string[]; // ids of the curriculums this song belongs to, if any
};
