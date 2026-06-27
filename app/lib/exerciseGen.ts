// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// Finger exercises are formulaic, so rather than ship one file per variant we
// generate them from a config: pick a type and key, then dial in octaves, hands,
// and (for arpeggios) inversion. The id round-trips the config so /play, track
// links, and mastery keep working; the canonical form (1 octave, right hand, root
// position) keeps its plain id (scale-c-major) for backward compatibility.

export type ExerciseType =
    | "major-scale"
    | "natural-minor-scale"
    | "harmonic-minor-scale"
    | "melodic-minor-scale"
    | "chromatic-scale"
    | "major-arpeggio"
    | "minor-arpeggio"
    | "dom7-arpeggio"
    | "dim7-arpeggio";

export type Hands = "right" | "left" | "both" | "contrary";

export type ExerciseConfig = {
    type: ExerciseType;
    key: string; // slug, e.g. "c", "csharp", "bflat"
    octaves: 1 | 2;
    hands: Hands;
    inversion: 0 | 1 | 2; // arpeggios only
};

type Note = { letter: string; octave: number; alter: number };

const ORDER = ["C", "D", "E", "F", "G", "A", "B"];
const STEP: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const SHARP_ORDER = ["F", "C", "G", "D", "A", "E", "B"];
const FLAT_ORDER = ["B", "E", "A", "D", "G", "C", "F"];

// slug -> [tonic letter, key-signature fifths] for the major and minor contexts.
const MAJOR_KEYS: Record<string, [string, number]> = {
    c: ["C", 0],
    g: ["G", 1],
    d: ["D", 2],
    a: ["A", 3],
    e: ["E", 4],
    b: ["B", 5],
    gflat: ["G", -6],
    dflat: ["D", -5],
    aflat: ["A", -4],
    eflat: ["E", -3],
    bflat: ["B", -2],
    f: ["F", -1],
};
const MINOR_KEYS: Record<string, [string, number]> = {
    a: ["A", 0],
    e: ["E", 1],
    b: ["B", 2],
    fsharp: ["F", 3],
    csharp: ["C", 4],
    gsharp: ["G", 5],
    eflat: ["E", -6],
    bflat: ["B", -5],
    f: ["F", -4],
    c: ["C", -3],
    g: ["G", -2],
    d: ["D", -1],
};
const MAJOR_SLUGS = [
    "c",
    "g",
    "d",
    "a",
    "e",
    "b",
    "gflat",
    "dflat",
    "aflat",
    "eflat",
    "bflat",
    "f",
];
const MINOR_SLUGS = [
    "a",
    "e",
    "b",
    "fsharp",
    "csharp",
    "gsharp",
    "eflat",
    "bflat",
    "f",
    "c",
    "g",
    "d",
];

const niceKey = (slug: string): string =>
    slug.endsWith("sharp")
        ? `${slug[0]!.toUpperCase()}♯`
        : slug.endsWith("flat")
          ? `${slug[0]!.toUpperCase()}♭`
          : slug.toUpperCase();

function alterFor(letter: string, fifths: number): number {
    if (fifths > 0) return SHARP_ORDER.slice(0, fifths).includes(letter) ? 1 : 0;
    if (fifths < 0) return FLAT_ORDER.slice(0, -fifths).includes(letter) ? -1 : 0;
    return 0;
}
const degreeOf = (letter: string, tonic: string): number =>
    (ORDER.indexOf(letter) - ORDER.indexOf(tonic) + 7) % 7;
const midiOf = (note: Note): number =>
    (note.octave + 1) * 12 + (STEP[note.letter] ?? 0) + note.alter;

// Diatonic letters from the tonic, ascending or descending, `octaves` octaves plus
// the closing tonic. The octave number ticks at C (scientific pitch).
function diatonic(tonic: string, fifths: number, octaves: number, dir: 1 | -1): Note[] {
    let index = ORDER.indexOf(tonic);
    let octave = 4;
    const notes: Note[] = [];
    for (let step = 0; step < octaves * 7; step++) {
        const letter = ORDER[index]!;
        notes.push({ letter, octave, alter: alterFor(letter, fifths) });
        if (dir === 1) {
            index = (index + 1) % 7;
            if (index === 0) octave += 1;
        } else {
            if (index === 0) octave -= 1;
            index = (index + 6) % 7;
        }
    }
    const last = ORDER[index]!;
    notes.push({ letter: last, octave, alter: alterFor(last, fifths) });
    return notes;
}

const raise = (notes: Note[], tonic: string, degrees: number[]): Note[] =>
    notes.map((n) =>
        degrees.includes(degreeOf(n.letter, tonic)) ? { ...n, alter: n.alter + 1 } : n,
    );
const turn = (asc: Note[], desc: Note[]): Note[] => asc.concat([...desc].reverse().slice(1));

const SHARP_SPELL: [string, number][] = [
    ["C", 0],
    ["C", 1],
    ["D", 0],
    ["D", 1],
    ["E", 0],
    ["F", 0],
    ["F", 1],
    ["G", 0],
    ["G", 1],
    ["A", 0],
    ["A", 1],
    ["B", 0],
];
const FLAT_SPELL: [string, number][] = [
    ["C", 0],
    ["D", -1],
    ["D", 0],
    ["E", -1],
    ["E", 0],
    ["F", 0],
    ["G", -1],
    ["G", 0],
    ["A", -1],
    ["A", 0],
    ["B", -1],
    ["B", 0],
];
function spell(midi: number, flats: boolean): Note {
    const pc = ((midi % 12) + 12) % 12;
    const [letter, alter] = (flats ? FLAT_SPELL : SHARP_SPELL)[pc]!;
    return { letter, octave: Math.floor(midi / 12) - 1, alter };
}

// The single-line note sequence (up then down) for a scale or chromatic run.
function scaleLine(type: ExerciseType, tonic: string, fifths: number, octaves: number): Note[] {
    if (type === "chromatic-scale") {
        const root = midiOf({ letter: tonic, octave: 4, alter: alterFor(tonic, fifths) });
        const up: Note[] = [];
        for (let s = 0; s <= 12 * octaves; s++) up.push(spell(root + s, false));
        const down: Note[] = [];
        for (let s = 12 * octaves - 1; s >= 0; s--) down.push(spell(root + s, true));
        return up.concat(down);
    }
    const base = diatonic(tonic, fifths, octaves, 1);
    if (type === "harmonic-minor-scale") {
        const r = raise(base, tonic, [6]);
        return turn(r, r);
    }
    if (type === "melodic-minor-scale") {
        return turn(raise(base, tonic, [5, 6]), base); // raised 6/7 up, natural down
    }
    return turn(base, base);
}

// The single-line arpeggio sequence (up then down) for a chord quality + inversion.
function arpeggioLine(
    type: ExerciseType,
    tonic: string,
    fifths: number,
    octaves: number,
    inversion: number,
): Note[] {
    const scale = diatonic(tonic, fifths, octaves + 1, 1); // +1 so inversions can reach up a chord tone
    const tones: Note[] = [];
    const flatten = (n: Note, by: number): Note => ({ ...n, alter: n.alter - by });
    for (let o = 0; o < octaves; o++) {
        if (type === "dim7-arpeggio") {
            // Built from the major scale by stacking minor thirds: the 3rd and 5th
            // drop a semitone, the diminished 7th two (C°7 = C E♭ G♭ B𝄫).
            tones.push(
                scale[o * 7]!,
                flatten(scale[o * 7 + 2]!, 1),
                flatten(scale[o * 7 + 4]!, 1),
                flatten(scale[o * 7 + 6]!, 2),
            );
        } else {
            tones.push(scale[o * 7]!, scale[o * 7 + 2]!, scale[o * 7 + 4]!);
            if (type === "dom7-arpeggio") {
                tones.push(flatten(scale[o * 7 + 6]!, 1));
            }
        }
    }
    tones.push(scale[octaves * 7]!);
    // Inversion: drop the lowest `inversion` chord tones and re-add them an octave up.
    const inverted = tones
        .slice(inversion)
        .concat(tones.slice(0, inversion).map((n) => ({ ...n, octave: n.octave + 1 })));
    return turn(inverted, inverted);
}

const shiftOctave = (notes: Note[], by: number): Note[] =>
    notes.map((n) => ({ ...n, octave: n.octave + by }));

function noteXml(note: Note): string {
    const alter = note.alter === 0 ? "" : `<alter>${note.alter}</alter>`;
    return `<note><pitch><step>${note.letter}</step>${alter}<octave>${note.octave}</octave></pitch><duration>1</duration><type>quarter</type></note>`;
}

function measuresXml(notes: Note[], fifths: number, clef: "G" | "F"): string {
    const perBar = 4;
    const clefXml = clef === "G" ? "<sign>G</sign><line>2</line>" : "<sign>F</sign><line>4</line>";
    const measures: string[] = [];
    for (let i = 0; i < notes.length; i += perBar) {
        const number = measures.length + 1;
        const attrs =
            number === 1
                ? `<attributes><divisions>1</divisions><key><fifths>${fifths}</fifths></key><time><beats>4</beats><beat-type>4</beat-type></time><clef>${clefXml}</clef></attributes><sound tempo="90"/>`
                : "";
        const body = notes
            .slice(i, i + perBar)
            .map(noteXml)
            .join("");
        measures.push(`    <measure number="${number}">${attrs}${body}</measure>`);
    }
    return measures.join("\n");
}

type Part = { id: string; clef: "G" | "F"; notes: Note[] };

function scoreXml(title: string, fifths: number, parts: Part[]): string {
    const list = parts
        .map((p) => `<score-part id="${p.id}"><part-name>Piano</part-name></score-part>`)
        .join("");
    const bodies = parts
        .map((p) => `  <part id="${p.id}">\n${measuresXml(p.notes, fifths, p.clef)}\n  </part>`)
        .join("\n");
    return `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="3.1">
  <work><work-title>${title}</work-title></work>
  <identification><creator type="composer">Finger exercise</creator></identification>
  <part-list>${list}</part-list>
${bodies}
</score-partwise>
`;
}

const isScale = (type: ExerciseType): boolean => type.endsWith("-scale");
function context(type: ExerciseType, key: string): { tonic: string; fifths: number } {
    const minor =
        type === "natural-minor-scale" ||
        type === "harmonic-minor-scale" ||
        type === "melodic-minor-scale" ||
        type === "minor-arpeggio";
    const [tonic, fifths] = (minor ? MINOR_KEYS : MAJOR_KEYS)[key] ?? ["C", 0];
    return { tonic, fifths };
}

export function generateExercise(config: ExerciseConfig): string {
    const { tonic, fifths } = context(config.type, config.key);
    const fx = config.type === "chromatic-scale" ? 0 : fifths;
    const line = isScale(config.type)
        ? scaleLine(config.type, tonic, fx, config.octaves)
        : arpeggioLine(config.type, tonic, fx, config.octaves, config.inversion);
    const title = exerciseTitle(config);
    let parts: Part[];
    if (config.hands === "left") {
        parts = [{ id: "P1", clef: "F", notes: shiftOctave(line, -2) }];
    } else if (config.hands === "both") {
        parts = [
            { id: "P1", clef: "G", notes: line },
            { id: "P2", clef: "F", notes: shiftOctave(line, -2) },
        ];
    } else if (config.hands === "contrary") {
        // Both start on the tonic and mirror: right ascends, left descends.
        const down = isScale(config.type)
            ? turn(diatonic(tonic, fx, config.octaves, -1), diatonic(tonic, fx, config.octaves, -1))
            : shiftOctave(line, 0);
        parts = [
            { id: "P1", clef: "G", notes: line },
            { id: "P2", clef: "F", notes: down },
        ];
    } else {
        parts = [{ id: "P1", clef: "G", notes: line }];
    }
    return scoreXml(title, fx, parts);
}

const SCALE_LABEL: Record<string, string> = {
    "major-scale": "major scale",
    "natural-minor-scale": "natural minor scale",
    "harmonic-minor-scale": "harmonic minor scale",
    "melodic-minor-scale": "melodic minor scale",
    "chromatic-scale": "chromatic scale",
    "major-arpeggio": "major arpeggio",
    "minor-arpeggio": "minor arpeggio",
    "dom7-arpeggio": "dominant 7th arpeggio",
    "dim7-arpeggio": "diminished 7th arpeggio",
};

export function exerciseTitle(config: ExerciseConfig): string {
    const parts = [`${niceKey(config.key)} ${SCALE_LABEL[config.type]}`];
    const forms: string[] = [];
    if (config.octaves === 2) forms.push("2 octaves");
    if (config.hands === "left") forms.push("left hand");
    if (config.hands === "both") forms.push("both hands");
    if (config.hands === "contrary") forms.push("contrary motion");
    if (config.inversion === 1) forms.push("1st inversion");
    if (config.inversion === 2) forms.push("2nd inversion");
    return forms.length ? `${parts[0]} · ${forms.join(", ")}` : parts[0]!;
}

// --- id <-> config ----------------------------------------------------------

const TYPE_TO_PARTS: Record<ExerciseType, [string, string]> = {
    "major-scale": ["scale", "major"],
    "natural-minor-scale": ["scale", "minor"],
    "harmonic-minor-scale": ["scale", "harmonic-minor"],
    "melodic-minor-scale": ["scale", "melodic-minor"],
    "chromatic-scale": ["scale", "chromatic"],
    "major-arpeggio": ["arpeggio", "major"],
    "minor-arpeggio": ["arpeggio", "minor"],
    "dom7-arpeggio": ["arpeggio", "dom7"],
    "dim7-arpeggio": ["arpeggio", "dim7"],
};
const HAND_CODE: Record<Hands, string> = { right: "r", left: "l", both: "b", contrary: "c" };
const CODE_HAND: Record<string, Hands> = { r: "right", l: "left", b: "both", c: "contrary" };

export function buildExerciseId(config: ExerciseConfig): string {
    const [kind, mode] = TYPE_TO_PARTS[config.type];
    const base = `${kind}-${config.key}-${mode}`;
    const canonical = config.octaves === 1 && config.hands === "right" && config.inversion === 0;
    if (canonical) return base;
    const inv = config.inversion ? `i${config.inversion}` : "";
    return `${base}.${config.octaves}${HAND_CODE[config.hands]}${inv}`;
}

export function parseExerciseId(id: string): ExerciseConfig | null {
    const [basePart, formPart] = id.split(".");
    if (!basePart) return null;
    let kind: "scale" | "arpeggio";
    let rest: string;
    if (basePart.startsWith("scale-")) {
        kind = "scale";
        rest = basePart.slice(6);
    } else if (basePart.startsWith("arpeggio-")) {
        kind = "arpeggio";
        rest = basePart.slice(9);
    } else {
        return null;
    }
    const modes =
        kind === "scale"
            ? ["harmonic-minor", "melodic-minor", "chromatic", "major", "minor"]
            : ["dom7", "dim7", "major", "minor"];
    const mode = modes.find((m) => rest.endsWith(`-${m}`));
    if (!mode) return null;
    const key = rest.slice(0, -(mode.length + 1));
    const type = (Object.keys(TYPE_TO_PARTS) as ExerciseType[]).find((t) => {
        const [k, m] = TYPE_TO_PARTS[t];
        return k === kind && m === mode;
    });
    if (!type) return null;
    const minorType =
        type === "natural-minor-scale" ||
        type === "harmonic-minor-scale" ||
        type === "melodic-minor-scale" ||
        type === "minor-arpeggio";
    if (!(minorType ? MINOR_KEYS : MAJOR_KEYS)[key]) {
        return null;
    }
    let octaves: 1 | 2 = 1;
    let hands: Hands = "right";
    let inversion: 0 | 1 | 2 = 0;
    if (formPart) {
        const match = formPart.match(/^([12])([rlbc])(?:i([12]))?$/);
        if (!match) return null;
        octaves = Number(match[1]) as 1 | 2;
        hands = CODE_HAND[match[2]!]!;
        inversion = (match[3] ? Number(match[3]) : 0) as 0 | 1 | 2;
    }
    return { type, key, octaves, hands, inversion };
}

// The browsable tiles: one per (type, key) in its canonical form.
export const EXERCISE_TILES: ExerciseConfig[] = [
    ...MAJOR_SLUGS.flatMap((key) =>
        (["major-scale", "major-arpeggio", "dom7-arpeggio", "dim7-arpeggio"] as ExerciseType[]).map(
            (type) => ({
                type,
                key,
                octaves: 1 as const,
                hands: "right" as const,
                inversion: 0 as const,
            }),
        ),
    ),
    ...MAJOR_SLUGS.map((key) => ({
        type: "chromatic-scale" as ExerciseType,
        key,
        octaves: 1 as const,
        hands: "right" as const,
        inversion: 0 as const,
    })),
    ...MINOR_SLUGS.flatMap((key) =>
        (
            [
                "natural-minor-scale",
                "harmonic-minor-scale",
                "melodic-minor-scale",
                "minor-arpeggio",
            ] as ExerciseType[]
        ).map((type) => ({
            type,
            key,
            octaves: 1 as const,
            hands: "right" as const,
            inversion: 0 as const,
        })),
    ),
];

export const isArpeggio = (type: ExerciseType): boolean => type.endsWith("-arpeggio");
