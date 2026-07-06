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

export type Interval = "single" | "thirds" | "sixths";

export type ExerciseConfig = {
    type: ExerciseType;
    key: string; // slug, e.g. "c", "csharp", "bflat"
    octaves: 1 | 2;
    hands: Hands;
    inversion: 0 | 1 | 2; // arpeggios only
    interval: Interval; // supported scales only
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
    const flatten = (n: Note, by: number): Note => ({ ...n, alter: n.alter - by });
    // Build the chord-tone sequence one octave past the run, so an inversion can take
    // a window starting higher up without re-adding a tone that collides with the next
    // octave's copy of it.
    const chordTones: Note[] = [];
    for (let o = 0; o <= octaves; o++) {
        if (type === "dim7-arpeggio") {
            // Built from the major scale by stacking minor thirds: the 3rd and 5th
            // drop a semitone, the diminished 7th two (C°7 = C E♭ G♭ B𝄫).
            chordTones.push(
                scale[o * 7]!,
                flatten(scale[o * 7 + 2]!, 1),
                flatten(scale[o * 7 + 4]!, 1),
                flatten(scale[o * 7 + 6]!, 2),
            );
        } else {
            chordTones.push(scale[o * 7]!, scale[o * 7 + 2]!, scale[o * 7 + 4]!);
            if (type === "dom7-arpeggio") {
                chordTones.push(flatten(scale[o * 7 + 6]!, 1));
            }
        }
    }
    // The run is `octaves` octaves of chord tones plus the closing tone an octave up;
    // an inversion starts `inversion` tones higher and ends the same distance up, so
    // it stays a strictly ascending arpeggio rather than duplicating a note.
    const tonesPerOctave = type === "dom7-arpeggio" || type === "dim7-arpeggio" ? 4 : 3;
    const runLength = tonesPerOctave * octaves + 1;
    const ascending = chordTones.slice(inversion, inversion + runLength);
    return turn(ascending, ascending);
}

const shiftOctave = (notes: Note[], by: number): Note[] =>
    notes.map((n) => ({ ...n, octave: n.octave + by }));
const shiftPositions = (positions: Note[][], by: number): Note[][] =>
    positions.map((pos) => shiftOctave(pos, by));

// A scale in thirds/sixths sounds each note together with the one `steps` scale-degrees
// above — a double stop. Only the symmetric scales (major, natural and harmonic
// minor) support it; the upper voice is the same scale offset, so its accidentals
// follow automatically.
export const supportsIntervals = (type: ExerciseType): boolean =>
    type === "major-scale" || type === "natural-minor-scale" || type === "harmonic-minor-scale";

function doubleStops(
    type: ExerciseType,
    tonic: string,
    fifths: number,
    octaves: number,
    steps: number,
): Note[][] {
    let extended = diatonic(tonic, fifths, octaves + 1, 1);
    if (type === "harmonic-minor-scale") {
        extended = raise(extended, tonic, [6]);
    }
    const up: Note[][] = [];
    for (let i = 0; i < octaves * 7 + 1; i++) {
        up.push([extended[i]!, extended[i + steps]!]);
    }
    return up.concat([...up].reverse().slice(1));
}

// A position holds the notes sounded together — one for a single line, two for a
// double stop. The first prints normally; the rest carry <chord/>.
function noteXml(note: Note, chord: boolean): string {
    const alter = note.alter === 0 ? "" : `<alter>${note.alter}</alter>`;
    return `<note>${chord ? "<chord/>" : ""}<pitch><step>${note.letter}</step>${alter}<octave>${note.octave}</octave></pitch><duration>1</duration><type>quarter</type></note>`;
}

function measuresXml(positions: Note[][], fifths: number, clef: "G" | "F"): string {
    const perBar = 4;
    const clefXml = clef === "G" ? "<sign>G</sign><line>2</line>" : "<sign>F</sign><line>4</line>";
    const measures: string[] = [];
    for (let i = 0; i < positions.length; i += perBar) {
        const number = measures.length + 1;
        const attrs =
            number === 1
                ? `<attributes><divisions>1</divisions><key><fifths>${fifths}</fifths></key><time><beats>4</beats><beat-type>4</beat-type></time><clef>${clefXml}</clef></attributes><sound tempo="90"/>`
                : "";
        const body = positions
            .slice(i, i + perBar)
            .map((pos) => pos.map((note, n) => noteXml(note, n > 0)).join(""))
            .join("");
        measures.push(`    <measure number="${number}">${attrs}${body}</measure>`);
    }
    return measures.join("\n");
}

type Part = { id: string; clef: "G" | "F"; positions: Note[][] };

function scoreXml(title: string, fifths: number, parts: Part[]): string {
    const list = parts
        .map((p) => `<score-part id="${p.id}"><part-name>Piano</part-name></score-part>`)
        .join("");
    const bodies = parts
        .map((p) => `  <part id="${p.id}">\n${measuresXml(p.positions, fifths, p.clef)}\n  </part>`)
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
// Contrary motion — right ascending, left descending from the same tonic — is a mirror
// of the same line, which is defined only for scales. An arpeggio has no such contrary
// form, so it falls back to both hands in parallel; normalising here keeps the rendered
// score and its title in agreement and avoids doubling the treble line onto the bass staff.
const effectiveHands = (config: ExerciseConfig): Hands =>
    config.hands === "contrary" && !isScale(config.type) ? "both" : config.hands;
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
    // Double stops apply to the supported scales, but not in contrary motion.
    const useInterval =
        config.interval !== "single" &&
        supportsIntervals(config.type) &&
        config.hands !== "contrary";
    const main: Note[][] = useInterval
        ? doubleStops(config.type, tonic, fx, config.octaves, config.interval === "thirds" ? 2 : 5)
        : line.map((note) => [note]);
    const title = exerciseTitle(config);
    const hands = effectiveHands(config);
    let parts: Part[];
    if (hands === "left") {
        parts = [{ id: "P1", clef: "F", positions: shiftPositions(main, -2) }];
    } else if (hands === "both") {
        parts = [
            { id: "P1", clef: "G", positions: main },
            { id: "P2", clef: "F", positions: shiftPositions(main, -2) },
        ];
    } else if (hands === "contrary") {
        // Both hands start on the tonic and mirror: right ascends, left descends. Only
        // scales reach here — effectiveHands sends an arpeggio down the "both" branch.
        const descending = diatonic(tonic, fx, config.octaves, -1);
        const down = turn(descending, descending);
        parts = [
            { id: "P1", clef: "G", positions: main },
            { id: "P2", clef: "F", positions: down.map((note) => [note]) },
        ];
    } else {
        parts = [{ id: "P1", clef: "G", positions: main }];
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
    const hands = effectiveHands(config);
    const forms: string[] = [];
    if (config.interval === "thirds") forms.push("in thirds");
    if (config.interval === "sixths") forms.push("in sixths");
    if (config.octaves === 2) forms.push("2 octaves");
    if (hands === "left") forms.push("left hand");
    if (hands === "both") forms.push("both hands");
    if (hands === "contrary") forms.push("contrary motion");
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

// Inversion (arpeggios) and interval (scales) are mutually exclusive, so they share
// the slot after the hand: i1/i2 for inversions, t/s for thirds/sixths.
const INTERVAL_CODE: Record<Interval, string> = { single: "", thirds: "t", sixths: "s" };
const CODE_INTERVAL: Record<string, Interval> = { t: "thirds", s: "sixths" };

export function buildExerciseId(config: ExerciseConfig): string {
    const [kind, mode] = TYPE_TO_PARTS[config.type];
    const base = `${kind}-${config.key}-${mode}`;
    const canonical =
        config.octaves === 1 &&
        config.hands === "right" &&
        config.inversion === 0 &&
        config.interval === "single";
    if (canonical) return base;
    const extra = config.inversion ? `i${config.inversion}` : INTERVAL_CODE[config.interval];
    return `${base}.${config.octaves}${HAND_CODE[config.hands]}${extra}`;
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
    let interval: Interval = "single";
    if (formPart) {
        const match = formPart.match(/^([12])([rlbc])(?:i([12])|([ts]))?$/);
        if (!match) return null;
        octaves = Number(match[1]) as 1 | 2;
        hands = CODE_HAND[match[2]!]!;
        inversion = (match[3] ? Number(match[3]) : 0) as 0 | 1 | 2;
        interval = match[4] ? CODE_INTERVAL[match[4]]! : "single";
    }
    return { type, key, octaves, hands, inversion, interval };
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
                interval: "single" as const,
            }),
        ),
    ),
    ...MAJOR_SLUGS.map((key) => ({
        type: "chromatic-scale" as ExerciseType,
        key,
        octaves: 1 as const,
        hands: "right" as const,
        inversion: 0 as const,
        interval: "single" as const,
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
            interval: "single" as const,
        })),
    ),
];

export const isArpeggio = (type: ExerciseType): boolean => type.endsWith("-arpeggio");
