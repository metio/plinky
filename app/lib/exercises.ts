// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

export type Exercise = {
    id: string;
    title: string;
    description: string;
    abc: string;
    tempo: number; // beats per minute for the metronome and count-in
    beatsPerBar: number; // matches the ABC meter, so the count-in fills one bar
    curriculums?: string[]; // ids of the curriculums this song belongs to, if any
};

// ABC bodies are monophonic and rest-free, with whole-bar grouping, so each
// rendered note maps to exactly one playable step. The trainer advances one
// expected note at a time, deriving the target pitch from abcjs itself.
export const exercises: Exercise[] = [
    {
        id: "c-major-scale",
        title: "C major scale",
        description: "One octave, all white keys — the place to start.",
        abc: "X:1\nT:C major scale\nM:4/4\nL:1/4\nK:C\nC D E F | G A B c |",
        tempo: 90,
        beatsPerBar: 4,
    },
    {
        id: "g-major-scale",
        title: "G major scale",
        description: "One octave with an F♯ — your first black key.",
        abc: "X:1\nT:G major scale\nM:4/4\nL:1/4\nK:G\nG A B c | d e f g |",
        tempo: 90,
        beatsPerBar: 4,
    },
    {
        id: "d-major-scale",
        title: "D major scale",
        description: "One octave with F♯ and C♯.",
        abc: "X:1\nT:D major scale\nM:4/4\nL:1/4\nK:D\nD E F G | A B c d |",
        tempo: 90,
        beatsPerBar: 4,
    },
    {
        id: "c-major-arpeggio",
        title: "C major arpeggio",
        description: "Up and down the triad in 3/4.",
        abc: "X:1\nT:C major arpeggio\nM:3/4\nL:1/4\nK:C\nC E G | c G E | C3 |",
        tempo: 100,
        beatsPerBar: 3,
    },
    {
        id: "a-minor-pentatonic",
        title: "A minor pentatonic",
        description: "Five notes that always sound good together.",
        abc: "X:1\nT:A minor pentatonic\nM:3/4\nL:1/4\nK:C\nA c d | e g a |",
        tempo: 100,
        beatsPerBar: 3,
    },
    {
        id: "f-major-scale",
        title: "F major scale",
        description: "One octave with a B♭.",
        abc: "X:1\nT:F major scale\nM:4/4\nL:1/4\nK:F\nF G A B | c d e f |",
        tempo: 90,
        beatsPerBar: 4,
    },
    {
        id: "twinkle",
        title: "Twinkle, Twinkle",
        description: "The opening phrase of the nursery rhyme.",
        abc: "X:1\nT:Twinkle, Twinkle\nM:4/4\nL:1/4\nK:C\nC C G G | A A G2 | F F E E | D D C2 |",
        tempo: 100,
        beatsPerBar: 4,
    },
    {
        id: "ode-to-joy",
        title: "Ode to Joy",
        description: "Beethoven's melody, first phrase.",
        abc: "X:1\nT:Ode to Joy\nM:4/4\nL:1/4\nK:C\nE E F G | G F E D | C C D E | E D D2 |",
        tempo: 96,
        beatsPerBar: 4,
    },
    {
        id: "c-major-triads",
        title: "C major triads",
        description: "Three-note chords up the scale — press all notes of each chord together.",
        abc: "X:1\nT:C major triads\nM:4/4\nL:1/4\nK:C\n[CEG] [DFA] [EGB] [Fac] |",
        tempo: 80,
        beatsPerBar: 4,
    },
    {
        id: "two-hand-c-major",
        title: "Two-hand C major",
        description: "A right-hand melody over a left-hand bass — your first grand staff.",
        abc: "X:1\nT:Two-hand C major\nM:4/4\nL:1/4\nV:1 clef=treble\nV:2 clef=bass\nV:1\nK:C\nc d e f | g f e d |\nV:2\nC2 G2 | C2 G2 |",
        tempo: 80,
        beatsPerBar: 4,
    },
];

export function findExercise(id: string | undefined): Exercise | undefined {
    return exercises.find((exercise) => exercise.id === id);
}
