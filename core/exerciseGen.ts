// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Finger exercises are formulaic, so rather than ship one file per variant we
// generate them from a config: pick a type and key, then dial in octaves, hands,
// and (for arpeggios) inversion. The id round-trips the config so /play, track
// links, and mastery keep working; the canonical form (1 octave, right hand, root
// position) keeps its plain id (scale-c-major) for backward compatibility.

import { midiOf as noteMidiOf } from "./notes";
import { LETTERS, alterFor, spellMidi } from "./notes";

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

// The key slug for a written key signature, which is what a score carries: a number of
// sharps (positive) or flats (negative), and whether the music is major or minor.
//
// The tables above map slug to signature, and this is the inverse. It exists because a
// score says "three flats" and an exercise wants "eflat" — the same fact, written the two
// different ways the two halves of the app already speak.
//
// Null outside the twelve keys each mode ships, which is what a signature of six sharps in
// a major piece is: real, rare, and not something to answer with the wrong scale.
export function keySlugFor(fifths: number, minor: boolean): string | null {
    const table = minor ? MINOR_KEYS : MAJOR_KEYS;
    for (const [slug, [, signature]] of Object.entries(table)) {
        if (signature === fifths) {
            return slug;
        }
    }
    return null;
}

// A key slug as a musician writes it — "eflat" is E♭. Exported because a warm-up that
// offers the next rung of the arcade should say which key it is about to ask for.
export const keyName = (slug: string): string =>
    slug.endsWith("sharp")
        ? `${slug[0]!.toUpperCase()}♯`
        : slug.endsWith("flat")
          ? `${slug[0]!.toUpperCase()}♭`
          : slug.toUpperCase();

const degreeOf = (letter: string, tonic: string): number =>
    (LETTERS.indexOf(letter) - LETTERS.indexOf(tonic) + 7) % 7;
const midiOf = (note: Note): number => noteMidiOf(note.letter, note.octave, note.alter);

// Diatonic letters from the tonic, ascending or descending, `octaves` octaves plus
// the closing tonic. The octave number ticks at C (scientific pitch).
function diatonic(tonic: string, fifths: number, octaves: number, dir: 1 | -1): Note[] {
    let index = LETTERS.indexOf(tonic);
    let octave = 4;
    const notes: Note[] = [];
    for (let step = 0; step < octaves * 7; step++) {
        const letter = LETTERS[index]!;
        notes.push({ letter, octave, alter: alterFor(letter, fifths) });
        if (dir === 1) {
            index = (index + 1) % 7;
            if (index === 0) octave += 1;
        } else {
            if (index === 0) octave -= 1;
            index = (index + 6) % 7;
        }
    }
    const last = LETTERS[index]!;
    notes.push({ letter: last, octave, alter: alterFor(last, fifths) });
    return notes;
}

const raise = (notes: Note[], tonic: string, degrees: number[]): Note[] =>
    notes.map((n) =>
        degrees.includes(degreeOf(n.letter, tonic)) ? { ...n, alter: n.alter + 1 } : n,
    );
const turn = (asc: Note[], desc: Note[]): Note[] => asc.concat([...desc].reverse().slice(1));

function spell(midi: number, flats: boolean): Note {
    // The exercise model calls the letter `letter`; the shared speller calls it `step`.
    const { step, alter, octave } = spellMidi(midi, flats);
    return { letter: step, octave, alter };
}

// The single-line note sequence (up then down) for a scale or chromatic run.
function scaleLine(type: ExerciseType, tonic: string, fifths: number, octaves: number): Note[] {
    if (type === "chromatic-scale") {
        // The tonic keeps the key's own spelling at every octave — an E-flat chromatic
        // scale starts on E flat, not D sharp — and the notes between are spelled by the
        // direction of travel: sharps on the way up, flats on the way down.
        const alter = alterFor(tonic, fifths);
        const root = midiOf({ letter: tonic, octave: 4, alter });
        const at = (s: number, flats: boolean): Note =>
            s % 12 === 0 ? { letter: tonic, octave: 4 + s / 12, alter } : spell(root + s, flats);
        const up: Note[] = [];
        for (let s = 0; s <= 12 * octaves; s++) up.push(at(s, false));
        const down: Note[] = [];
        for (let s = 12 * octaves - 1; s >= 0; s--) down.push(at(s, true));
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

// The same line, for a hand travelling the other way: down from the tonic and back.
//
// Contrary motion is both hands playing THE SAME SCALE in opposite directions, so the
// descending hand has to be built from the type's own rule. Built from a plain diatonic
// descent instead, a chromatic scale gave that hand a diatonic one — a different scale,
// and ten notes shorter, so the hands never met — and both minors that alter a degree
// gave it the natural minor.
//
// `raise` works by scale degree rather than by position, so the alteration rules carry
// over to a descending line unchanged.
function scaleLineDown(type: ExerciseType, tonic: string, fifths: number, octaves: number): Note[] {
    if (type === "chromatic-scale") {
        const alter = alterFor(tonic, fifths);
        const root = midiOf({ letter: tonic, octave: 4, alter });
        const at = (s: number, flats: boolean): Note =>
            s % 12 === 0 ? { letter: tonic, octave: 4 - s / 12, alter } : spell(root - s, flats);
        const down: Note[] = [];
        for (let s = 0; s <= 12 * octaves; s++) down.push(at(s, true));
        const up: Note[] = [];
        for (let s = 12 * octaves - 1; s >= 0; s--) up.push(at(s, false));
        return down.concat(up);
    }
    const base = diatonic(tonic, fifths, octaves, -1);
    if (type === "harmonic-minor-scale") {
        // The raised seventh stands in both directions, which is what makes it harmonic.
        const r = raise(base, tonic, [6]);
        return turn(r, r);
    }
    if (type === "melodic-minor-scale") {
        // Natural on the way down, raised sixth and seventh on the way back up — the
        // ascending rule, read in the direction this hand actually travels.
        return turn(base, raise(base, tonic, [5, 6]));
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

// The config with every dial that does not apply to this exercise returned to its
// default, so the id, the title and the notes always describe the same thing.
//
// The dials are not independent: an inversion means nothing to a scale, a double stop
// means nothing to an arpeggio or to contrary motion, and contrary motion means nothing
// to an arpeggio (which has no mirror form, so it plays both hands in parallel). The
// generator has always ignored the inapplicable ones — but the title read them anyway,
// and the id encoded them, so choosing "in thirds" and then "contrary motion" produced
// a second id for an exercise already reachable under another, and a title advertising
// thirds the score does not contain. Normalising once, at the edge, is what makes the id
// a name for the exercise rather than for the route taken to it.
function normalizeExercise(config: ExerciseConfig): ExerciseConfig {
    const hands: Hands =
        config.hands === "contrary" && !isScale(config.type) ? "both" : config.hands;
    return {
        ...config,
        hands,
        inversion: isArpeggio(config.type) ? config.inversion : 0,
        interval:
            supportsIntervals(config.type) && hands !== "contrary" ? config.interval : "single",
    };
}
// Which of the two key tables a type is read against. Minor and major name their keys
// differently — a slug of "fsharp" is a key in one and not in the other — so getting this
// wrong does not read the wrong tonic, it fails to find the key at all.
function isMinorType(type: ExerciseType): boolean {
    return (
        type === "natural-minor-scale" ||
        type === "harmonic-minor-scale" ||
        type === "melodic-minor-scale" ||
        type === "minor-arpeggio"
    );
}

function context(type: ExerciseType, key: string): { tonic: string; fifths: number } {
    const [tonic, fifths] = (isMinorType(type) ? MINOR_KEYS : MAJOR_KEYS)[key] ?? ["C", 0];
    return { tonic, fifths };
}

export function generateExercise(raw: ExerciseConfig): string {
    const config = normalizeExercise(raw);
    const { tonic, fifths } = context(config.type, config.key);
    // A chromatic run is written with no signature — every note carries its own
    // accidental — but it still starts on the key's tonic: an E-flat chromatic scale
    // begins on E flat, and the signature is the one thing that is written as C.
    const fx = config.type === "chromatic-scale" ? 0 : fifths;
    const line = isScale(config.type)
        ? scaleLine(config.type, tonic, fifths, config.octaves)
        : arpeggioLine(config.type, tonic, fx, config.octaves, config.inversion);
    // Normalisation has already cleared the interval wherever double stops do not apply.
    const main: Note[][] =
        config.interval !== "single"
            ? doubleStops(
                  config.type,
                  tonic,
                  fx,
                  config.octaves,
                  config.interval === "thirds" ? 2 : 5,
              )
            : line.map((note) => [note]);
    const title = exerciseTitle(config);
    const hands = config.hands;
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
        const down = scaleLineDown(config.type, tonic, fifths, config.octaves);
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

// What an exercise is called, before anything says it: the key it is in, what it is, and
// the ways this one differs from the plain form. The words are the caller's, because
// "C major scale" is a sentence with a different shape in every language — Germans join
// it up, Japanese puts the key inside the word — so a translator writes the whole title
// rather than a noun somebody else concatenates a key onto.
export type ExerciseForm =
    | "thirds"
    | "sixths"
    | "two-octaves"
    | "left-hand"
    | "both-hands"
    | "contrary"
    | "inversion-1"
    | "inversion-2";

export type ExerciseTitle = { key: string; type: ExerciseType; forms: ExerciseForm[] };

export function exerciseTitleParts(raw: ExerciseConfig): ExerciseTitle {
    const config = normalizeExercise(raw);
    const forms: ExerciseForm[] = [];
    if (config.interval === "thirds") forms.push("thirds");
    if (config.interval === "sixths") forms.push("sixths");
    if (config.octaves === 2) forms.push("two-octaves");
    if (config.hands === "left") forms.push("left-hand");
    if (config.hands === "both") forms.push("both-hands");
    if (config.hands === "contrary") forms.push("contrary");
    if (config.inversion === 1) forms.push("inversion-1");
    if (config.inversion === 2) forms.push("inversion-2");
    return { key: keyName(config.key), type: config.type, forms };
}

// The English name, for the score's own <work-title> and for the tooling that builds the
// exercise manifest. What a player reads is named in their language by the app; a
// MusicXML file exported from here carries the one spelling every catalogue of scales
// has used, whoever opens it.
export function exerciseTitle(raw: ExerciseConfig): string {
    const { key, type, forms } = exerciseTitleParts(raw);
    const named = `${key} ${SCALE_LABEL[type]}`;
    return forms.length ? `${named} · ${forms.map((form) => FORM_LABEL[form]).join(", ")}` : named;
}

const FORM_LABEL: Record<ExerciseForm, string> = {
    thirds: "in thirds",
    sixths: "in sixths",
    "two-octaves": "2 octaves",
    "left-hand": "left hand",
    "both-hands": "both hands",
    contrary: "contrary motion",
    "inversion-1": "1st inversion",
    "inversion-2": "2nd inversion",
};

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

// The exercise's name. Normalised first, so two configs that generate the same score
// share one id — and, because the slot after the hand carries either an inversion or an
// interval and never both, so two that generate DIFFERENT scores never can.
export function buildExerciseId(raw: ExerciseConfig): string {
    const config = normalizeExercise(raw);
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
    if (!(isMinorType(type) ? MINOR_KEYS : MAJOR_KEYS)[key]) {
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
    // A hand-written id may name a form the exercise has no version of — an inversion of
    // a scale, contrary motion on an arpeggio. It resolves to the nearest real exercise
    // rather than to nothing, so the link still opens something playable, and building an
    // id back from the result yields that exercise's own canonical name.
    return normalizeExercise({ type, key, octaves, hands, inversion, interval });
}

// The browsable tiles: one per (type, key) in its canonical form.
// What a browsable tile is: the plainest reading of a form in a key. One octave, right
// hand, root position, one note at a time — every other combination is something a player
// asks for on the exercise's own page rather than something the shelf offers up front.
const browsable = (type: ExerciseType, key: string): ExerciseConfig => ({
    type,
    key,
    octaves: 1,
    hands: "right",
    inversion: 0,
    interval: "single",
});

const MAJOR_FORMS: ExerciseType[] = [
    "major-scale",
    "major-arpeggio",
    "dom7-arpeggio",
    "dim7-arpeggio",
];
const MINOR_FORMS: ExerciseType[] = [
    "natural-minor-scale",
    "harmonic-minor-scale",
    "melodic-minor-scale",
    "minor-arpeggio",
];

// The keys come from the tables themselves rather than a list beside them: a second list
// in the same order is a chance to add a key to one and not the other.
export const EXERCISE_TILES: ExerciseConfig[] = [
    ...Object.keys(MAJOR_KEYS).flatMap((key) => MAJOR_FORMS.map((type) => browsable(type, key))),
    // A chromatic run covers every semitone regardless of key — a "G♭ chromatic
    // scale" is just the C one transposed, and enharmonic keys even fingerprint to
    // the same content id — so exactly one canonical C-rooted tile is browsable.
    browsable("chromatic-scale", "c"),
    ...Object.keys(MINOR_KEYS).flatMap((key) => MINOR_FORMS.map((type) => browsable(type, key))),
];

export const isArpeggio = (type: ExerciseType): boolean => type.endsWith("-arpeggio");
