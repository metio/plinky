// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { type Incipit, incipitOf } from "./incipit";
import { pitchMidiOf } from "./notes";
import { stavesPerPart } from "./accompaniment";
import { fingerPositions, positionsCost } from "./fingering";
import { partsOf } from "./parts";
import { gapTracker, scoreClock, TIMED_NODES } from "./scoreTiming";
import type { XmlCodec } from "./xml";

// How hard a score is to *play*, derived from the fingering cost model — the same
// piano-ergonomics engine behind the fingering trainer. Each hand's notes are
// worked into their optimal fingering and the per-note effort averaged; that
// scalar maps onto a 1–8 grade, calibrated per content category so the hardest
// finger exercise sits at the top of its own scale rather than at the bottom of
// the pieces' scale. The score is read through the injected XML codec, so this
// runs identically in the browser, in the import tooling, and in tests.

function midiOf(note: Element): number | null {
    const pitch = note.querySelector("pitch");
    // A rest, or an unpitched note — nothing to finger.
    return pitch ? pitchMidiOf(pitch) : null;
}

// A score's two hands, with the time the player has between one position and the next.
export type Hands = {
    right: number[][];
    left: number[][];
    gaps: { right: number[]; left: number[] };
};

// Split a score's notes into the two hands' position sequences (a position is a
// chord, or a single note). A note with <chord/> joins the hand's current position
// instead of starting a new one.
//
// Which staves are the player's is read from the score rather than assumed. Taking the
// first staff for the right hand is right for a grand staff and wrong for everything
// else: in a song, staff 1 is the singer, so the difficulty of a piano part was being
// measured against a vocal line the pianist never plays — a melody with no chords, no
// left hand and none of a keyboard's reach, which reads as far easier than the
// accompaniment underneath it. core/parts.ts exists for exactly this and the grader was
// never wired to it.
export function parsePositions(codec: XmlCodec, xml: string): Hands {
    const doc = codec.parse(xml);
    return doc ? positionsOf(doc) : { right: [], left: [], gaps: { right: [], left: [] } };
}

// The same, off a document already open — what measureScore reads, so grade, cost and
// incipit come off one parse of a score rather than one each.
export function positionsOf(doc: Document): Hands {
    const right: number[][] = [];
    const left: number[][] = [];
    // Seconds from each position's onset to the one before it — how long the player has
    // to get the hand there. gaps[0] is unused: nothing precedes the first position.
    const gaps = { right: [] as number[], left: [] as number[] };
    const counts = stavesPerPart(doc);
    const parts = partsOf(counts);
    const written = Array.from(
        doc.querySelectorAll("score-partwise > part, score-timewise > part"),
    );
    // A document with no <part> at all is not something to grade as silence: fall back to
    // the whole thing as one part, which is what the plain grand-staff case looks like.
    const scanned: { nodes: Iterable<Element>; staves: number }[] =
        written.length > 0
            ? written.map((part, index) => ({
                  nodes: part.querySelectorAll(TIMED_NODES),
                  staves: counts[index] ?? 1,
              }))
            : [{ nodes: doc.querySelectorAll(TIMED_NODES), staves: 2 }];

    // <staff> counts from 1 within its own part; partsOf names staves across the whole
    // score. The running offset of the part a note sits in is what turns one into the
    // other.
    let offset = 0;
    const clock = scoreClock();
    const timing = { right: gapTracker(), left: gapTracker() };
    for (const part of scanned) {
        for (const node of part.nodes) {
            const seconds = clock.read(node);
            if (node.tagName !== "note") {
                continue;
            }
            const note = node;
            const within = Number.parseInt(
                note.querySelector("staff")?.textContent?.trim() ?? "1",
                10,
            );
            const staff = offset + (Number.isInteger(within) && within > 0 ? within - 1 : 0);
            if (staff !== parts.right && staff !== parts.left) {
                // Another instrument's line, or a singer's. Not the player's to read, so
                // not part of how hard this is to play — but it still takes time off the
                // clock, which is shared with the staves that are.
                continue;
            }
            const side = staff === parts.left ? "left" : "right";
            const hand = side === "left" ? left : right;
            const midi = midiOf(note);
            if (midi === null) {
                // A rest, or something unpitched: no position, but the clock still runs
                // and the hand is free to travel.
                timing[side].skip(seconds);
                continue;
            }
            if (note.querySelector("chord") && hand.length > 0) {
                hand[hand.length - 1]!.push(midi);
                continue;
            }
            gaps[side].push(timing[side].start(seconds));
            hand.push([midi]);
        }
        offset += part.staves;
    }
    // Nothing on the staves the model chose. Either it chose wrong — a six-staff
    // orchestral reduction filed as one "Piano" part, where the top two carry nothing —
    // or this is not keyboard music at all. Either way, reporting no notes would grade
    // the piece as the easiest thing in the catalogue and put it in front of a beginner,
    // so fall back to reading every staff, which is what this did before it knew about
    // parts and can never be worse than that.
    if (right.length === 0 && left.length === 0) {
        const fallbackClock = scoreClock();
        const fallbackTiming = { right: gapTracker(), left: gapTracker() };
        for (const node of doc.querySelectorAll(TIMED_NODES)) {
            const seconds = fallbackClock.read(node);
            if (node.tagName !== "note") {
                continue;
            }
            const note = node;
            const side =
                note.querySelector("staff")?.textContent?.trim() === "2" ? "left" : "right";
            const hand = side === "left" ? left : right;
            const midi = midiOf(note);
            if (midi === null) {
                fallbackTiming[side].skip(seconds);
                continue;
            }
            if (note.querySelector("chord") && hand.length > 0) {
                hand[hand.length - 1]!.push(midi);
                continue;
            }
            gaps[side].push(fallbackTiming[side].start(seconds));
            hand.push([midi]);
        }
    }
    return { right, left, gaps };
}

export function handEffort(positions: number[][], hand: "left" | "right", gaps?: number[]): number {
    if (positions.length === 0) {
        return 0;
    }
    return positionsCost(
        positions,
        fingerPositions(positions, hand, undefined, gaps),
        hand,
        undefined,
        gaps,
    );
}

// The playing effort of already-parsed hands: total fingering cost across both,
// averaged over every note — so length doesn't inflate it and a short hard piece
// outranks a long easy one. Returns 0 for no notes, which callers must read as
// "nothing to measure" rather than "easiest", since a gentle in-hand line also
// costs ~0.
function effortOf(hands: Hands): number {
    const notes = hands.right.length + hands.left.length;
    if (notes === 0) {
        return 0;
    }
    return (
        (handEffort(hands.right, "right", hands.gaps.right) +
            handEffort(hands.left, "left", hands.gaps.left)) /
        notes
    );
}

// How fast the hands have to move, and how many independent lines they have to keep
// apart. Fingering effort alone measures the SHAPE of a piece — stretch, position
// changes — and is blind to both, which is how a Czerny étude of running sixteenths in
// three voices scored below the grade-1 boundary while a slow Satie piece with wide
// left-hand chords scored top of the scale. Speed and texture are what a player means by
// "hard" at least as often as stretch is.

// Notes per second in the piece's quick passages. Read off the tenth percentile of note
// lengths rather than the mean: a piece is as fast as its fastest sustained writing, and
// averaging buries a run of sixteenths under the long notes around it.
export const SPEED_PERCENTILE = 0.1;
// Below this the writing is comfortable at sight and costs nothing — around a note every
// third of a second, quarter notes at a walking tempo.
export const SPEED_FLOOR_NPS = 3;
// What one note per second beyond the floor is worth, on the same scale as fingering
// cost. Sixteenths at 120 (eight a second) land about two points up.
export const SPEED_WEIGHT = 0.4;
// What each independent voice beyond the first, within one hand, is worth. Two lines in
// one hand is a real step up in coordination; three is another.
export const TEXTURE_WEIGHT = 0.6;

function beatsPerNote(note: Element, divisions: number): number | null {
    // A chord member sounds with the note before it and takes no time of its own; a grace
    // note carries no duration at all.
    if (note.querySelector("chord") || note.querySelector("grace")) {
        return null;
    }
    const raw = Number(note.querySelector("duration")?.textContent ?? "");
    if (!Number.isFinite(raw) || raw <= 0 || divisions <= 0) {
        return null;
    }
    return raw / divisions;
}

// The speed and texture of an already-parsed document, in one walk.
export function readPace(doc: Document): { notesPerSecond: number; voices: number } {
    let divisions = 1;
    let tempo = 0;
    const beats: number[] = [];
    // Distinct voice numbers seen per staff — two lines in one hand, not two hands.
    const voicesByStaff = new Map<number, Set<string>>();
    // The player's staves, as parsePositions names them: on an art song the singer's
    // line is not the pianist's to read, and its notes would otherwise set the speed and
    // its voice would count as a third hand.
    const counts = stavesPerPart(doc);
    const parts = partsOf(counts);
    const written = Array.from(
        doc.querySelectorAll("score-partwise > part, score-timewise > part"),
    );
    const scanned: { nodes: Iterable<Element>; staves: number }[] =
        written.length > 0
            ? written.map((part, index) => ({
                  nodes: part.querySelectorAll("divisions, sound, note"),
                  staves: counts[index] ?? 1,
              }))
            : [{ nodes: doc.querySelectorAll("divisions, sound, note"), staves: 2 }];
    let offset = 0;
    for (const part of scanned) {
        for (const node of part.nodes) {
            if (node.tagName === "divisions") {
                const value = Number(node.textContent ?? "");
                if (Number.isFinite(value) && value > 0) {
                    divisions = value;
                }
                continue;
            }
            if (node.tagName === "sound") {
                const value = Number(node.getAttribute("tempo") ?? "");
                if (Number.isFinite(value) && value > 0 && tempo === 0) {
                    tempo = value;
                }
                continue;
            }
            if (node.querySelector("rest")) {
                continue;
            }
            const within = Number.parseInt(
                node.querySelector("staff")?.textContent?.trim() ?? "1",
                10,
            );
            const staff = offset + (Number.isInteger(within) && within > 0 ? within - 1 : 0);
            if (staff !== parts.right && staff !== parts.left) {
                continue;
            }
            const voice = node.querySelector("voice")?.textContent?.trim() ?? "1";
            let seen = voicesByStaff.get(staff);
            if (!seen) {
                seen = new Set();
                voicesByStaff.set(staff, seen);
            }
            seen.add(voice);
            const beat = beatsPerNote(node, divisions);
            if (beat !== null) {
                beats.push(beat);
            }
        }
        offset += part.staves;
    }
    // A score that states no tempo is read at a moderate one rather than assumed still.
    const played = tempo > 0 ? tempo : 100;
    let notesPerSecond = 0;
    if (beats.length > 0) {
        const sorted = [...beats].sort((a, b) => a - b);
        const quick =
            sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * SPEED_PERCENTILE))]!;
        notesPerSecond = quick > 0 ? played / 60 / quick : 0;
    }
    const voices = Math.max(1, ...[...voicesByStaff.values()].map((set) => set.size));
    return { notesPerSecond, voices };
}

// What each sharp or flat in the key signature is worth. Every graded syllabus builds its
// early years around the key: a first-year piece is in C, F or G, and reading four sharps
// is a later skill than reading one. Nothing else in the model sees a key signature — a
// piece transposed from C to E fingers almost identically and is not almost as easy.
export const KEY_WEIGHT = 0.7;

// What each octave a hand covers beyond its first is worth. A beginner piece keeps the
// hand in one five-finger position; moving around the keyboard is the next thing asked
// of them. Fingering effort sees each move as it happens and averages them away, so a
// piece that ranges widely but gently reads the same as one that never leaves middle C.
export const RANGE_WEIGHT = 1.0;

// The widest key signature stated anywhere in the score, in sharps or flats.
export function readKey(doc: Document): number {
    let widest = 0;
    for (const node of doc.querySelectorAll("key > fifths")) {
        const value = Number(node.textContent ?? "");
        if (Number.isFinite(value)) {
            widest = Math.max(widest, Math.abs(value));
        }
    }
    return Math.min(widest, 7);
}

// How far the busier hand travels across the piece, in octaves beyond the first. A hand
// that stays within an octave asks for no repositioning and costs nothing here.
export function readRange(hands: Hands): number {
    const octaves = (positions: number[][]): number => {
        const pitches = positions.flat();
        if (pitches.length === 0) {
            return 0;
        }
        return (Math.max(...pitches) - Math.min(...pitches)) / 12;
    };
    return Math.max(0, Math.max(octaves(hands.right), octaves(hands.left)) - 1);
}

// What a doubling of length is worth. Everything else here measures the hardest moment in
// a piece; this is the only term that answers "how much of it is there".
//
// Held deliberately weak and logarithmic. Length is real — a first-year piece is sixteen
// bars and a diploma piece is several pages, and holding a performance together to the end
// is part of what a grade certifies — but it is also the most corpus-dependent thing about
// a score. The harvest contains truncated imports and single movements filed beside whole
// sonatas, and a linear charge would grade those by how much of the file survived. A
// doubling being worth a fixed small amount says length matters without letting it decide.
export const LENGTH_WEIGHT = 2.5;

// The length of a short beginner piece: roughly sixteen bars of two-handed writing. A
// score this size pays nothing for its length.
const LENGTH_FLOOR_NOTES = 64;

// Past this many doublings — a piece around sixteen times the length of a short beginner
// one — more notes say nothing further about difficulty, and the cap is what keeps a
// truncated import and a complete edition of the same piece within reach of each other.
const LENGTH_CEILING_DOUBLINGS = 4;

export function readLength(hands: Hands): number {
    const notes = hands.right.length + hands.left.length;
    const doublings = Math.log2(Math.max(notes, 1) / LENGTH_FLOOR_NOTES);
    return Math.min(LENGTH_CEILING_DOUBLINGS, Math.max(0, doublings));
}

// What speed and texture add to a score's cost. Zero for a slow single line, which is
// what a beginner piece is, so an easy piece keeps the cost its fingering earned it.
export function paceCost(pace: { notesPerSecond: number; voices: number }): number {
    const speed = Math.max(0, pace.notesPerSecond - SPEED_FLOOR_NPS) * SPEED_WEIGHT;
    const texture = Math.max(0, pace.voices - 1) * TEXTURE_WEIGHT;
    return speed + texture;
}

// The score's raw playing effort, parsed from its MusicXML: what the hands must shape,
// plus what they must do at speed and hold apart.
export function rawDifficulty(codec: XmlCodec, xml: string): number {
    const doc = codec.parse(xml);
    if (!doc) {
        return 0;
    }
    return difficultyOf(doc, positionsOf(doc));
}

// The effort of a document already open, with its positions already read.
export function difficultyOf(doc: Document, hands: Hands): number {
    // Nothing FINGERABLE means nothing to measure; callers read 0 that way, and a pace
    // term added to it would dress an unreadable import up as a plausible score. Note
    // that this is emptiness, not cheapness: a real line that happens to cost nothing to
    // finger — a repeated note, a gentle in-hand phrase — still has a speed and a
    // texture, and reading its effort of 0 as "nothing here" would silently drop both.
    if (hands.right.length + hands.left.length === 0) {
        return 0;
    }
    return (
        effortOf(hands) +
        paceCost(readPace(doc)) +
        readKey(doc) * KEY_WEIGHT +
        readRange(hands) * RANGE_WEIGHT +
        readLength(hands) * LENGTH_WEIGHT
    );
}

export type Category = "scale" | "arpeggio" | "piece";

// Scales and arpeggios are recognised by their catalogue id prefix; everything
// else is a piece.
export function categoryOf(id: string): Category {
    if (id.startsWith("scale-")) {
        return "scale";
    }
    if (id.startsWith("arpeggio-")) {
        return "arpeggio";
    }
    return "piece";
}

export const MAX_GRADE = 8;

// The cost breakpoints between grades 1–8, calibrated PER category so each is graded on
// its own scale — otherwise every finger exercise lands below the easiest piece, since
// scales and arpeggios cost more to finger than a stepwise tune.
//
// The two exercise scales are the octiles of the shipped tiles, which is the right cut for
// them and the wrong one for pieces: the tiles are a fixed, complete, deliberately
// progressive curriculum, so "in the third eighth of the scales" is a statement about that
// curriculum and stays put. The piece catalogue is a harvest that keeps growing, where the
// same cut meant a piece changed grade whenever something else was imported.
//
// They do not follow the difficulty model on their own, so `npm run songs:bake` fails when
// a category's tiles collapse into one grade, and `npm run songs:calibrate` prints the
// octiles they currently imply.
//
// The `piece` breakpoints are fixed numbers, not a cut of the catalogue. They come from
// `npm run songs:calibrate`, which measures teaching collections whose real-world grade is
// settled — Anna Magdalena, Burgmüller op.100, the two-part inventions, the Chopin études —
// and puts each boundary halfway between the grades it separates.
//
// Fixed is the point. Cutting the corpus into eight equal bins made a grade mean "in the
// easiest eighth of whatever has been harvested so far", so every import silently re-graded
// every piece a player had already worked on, and a piece's grade said nothing about a
// piano student. A grade now means the same thing after an import as before it, and a piece
// only moves when the model that measures it changes.
const GRADE_THRESHOLDS: Record<Category, number[]> = {
    piece: [5.498, 7.785, 10.513, 13.079, 15.349, 18.984, 22.041],
    scale: [0.95, 1.05, 1.75, 2.45, 3.1, 3.25, 3.9],
    arpeggio: [1.117, 1.817, 1.983, 2.683, 3.336, 3.917, 4.25],
};

// What the import and bake tooling grades a piece against, so the manifest and the grade
// chip a player sees can never be read off different numbers.
export const pieceBoundaries: readonly number[] = GRADE_THRESHOLDS.piece;

// Everything the library and the grade ladder want to know about a score held on the
// device, read off ONE parse of its MusicXML: the grade, the cost it was placed by, and
// the opening bar. Memoised by id, which MUST be the content fingerprint (songId): the
// cache trusts the id to identify the notes and never re-reads xml on a hit, so a caller
// keying by anything else — a title slug, say — makes distinct scores collide onto one
// measure.
//
// One parse matters because the fingering search is the expensive half of the model:
// remeasuring the catalogue's costs takes about half an hour. Read separately, the grade,
// the cost and the incipit each opened the document again, and the grade ran the search
// a second time for a cost it then threw away — six parses and two searches per score,
// on every visit to the library.
export type ScoreMeasure = {
    grade: number;
    cost: number;
    // How many fingerable notes the score holds. Zero means empty or unreadable — nothing
    // to practise, and nothing the cost of 0 beside it says anything about.
    notes: number;
    incipit: Incipit | null;
};

const measureCache = new Map<string, ScoreMeasure>();

export function measureScore(codec: XmlCodec, id: string, xml: string): ScoreMeasure {
    const cached = measureCache.get(id);
    if (cached !== undefined) {
        return cached;
    }
    const doc = codec.parse(xml);
    const hands = doc ? positionsOf(doc) : { right: [], left: [], gaps: { right: [], left: [] } };
    const notes = hands.right.length + hands.left.length;
    // No fingerable notes means an empty or unreadable score, not the gentlest piece — a
    // real in-hand line also costs ~0. Grade it at the top so it can't pad the beginner
    // pools, distinguishing it from a measured-easy cost of 0.
    const cost = doc && notes > 0 ? difficultyOf(doc, hands) : 0;
    const grade = notes === 0 ? MAX_GRADE : gradeForCost(cost, categoryOf(id));
    const measure = { grade, cost, notes, incipit: doc ? incipitOf(doc) : null };
    measureCache.set(id, measure);
    return measure;
}

// A score's 1–8 grade: its fingering-cost difficulty placed against its category's
// thresholds. Memoised by id like measureScore, of which it is one field.
export function gradeOf(codec: XmlCodec, id: string, xml: string): number {
    return measureScore(codec, id, xml).grade;
}

function gradeForCost(cost: number, category: Category): number {
    let grade = 1;
    for (const threshold of GRADE_THRESHOLDS[category]) {
        if (cost <= threshold) {
            break;
        }
        grade += 1;
    }
    return grade;
}
