// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { stavesPerPart } from "./accompaniment";
import { fingerPositions, positionsCost } from "./fingering";
import { SEMITONE } from "./notes";
import { partsOf } from "./parts";
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
    if (!pitch) {
        return null; // a rest, or an unpitched note — nothing to finger
    }
    const step = pitch.querySelector("step")?.textContent?.trim() ?? "";
    const semitone = SEMITONE[step];
    if (semitone === undefined) {
        return null;
    }
    const octave = Number(pitch.querySelector("octave")?.textContent ?? "4");
    const alter = Number(pitch.querySelector("alter")?.textContent ?? "0");
    const midi = (octave + 1) * 12 + semitone + alter;
    // A non-numeric <octave> or <alter> yields NaN; skip it rather than fingering
    // a note that has no real pitch.
    return Number.isFinite(midi) ? midi : null;
}

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
export function parsePositions(
    codec: XmlCodec,
    xml: string,
): { right: number[][]; left: number[][] } {
    const right: number[][] = [];
    const left: number[][] = [];
    const doc = codec.parse(xml);
    if (!doc) {
        return { right, left };
    }
    const counts = stavesPerPart(doc);
    const parts = partsOf(counts);
    const written = Array.from(
        doc.querySelectorAll("score-partwise > part, score-timewise > part"),
    );
    // A document with no <part> at all is not something to grade as silence: fall back to
    // the whole thing as one part, which is what the plain grand-staff case looks like.
    const scanned: { notes: Iterable<Element>; staves: number }[] =
        written.length > 0
            ? written.map((part, index) => ({
                  notes: part.querySelectorAll("note"),
                  staves: counts[index] ?? 1,
              }))
            : [{ notes: doc.querySelectorAll("note"), staves: 2 }];

    // <staff> counts from 1 within its own part; partsOf names staves across the whole
    // score. The running offset of the part a note sits in is what turns one into the
    // other.
    let offset = 0;
    for (const part of scanned) {
        for (const note of part.notes) {
            const midi = midiOf(note);
            if (midi === null) {
                continue;
            }
            const within = Number.parseInt(
                note.querySelector("staff")?.textContent?.trim() ?? "1",
                10,
            );
            const staff = offset + (Number.isInteger(within) && within > 0 ? within - 1 : 0);
            if (staff !== parts.right && staff !== parts.left) {
                // Another instrument's line, or a singer's. Not the player's to read, so
                // not part of how hard this is to play.
                continue;
            }
            const hand = staff === parts.left ? left : right;
            if (note.querySelector("chord") && hand.length > 0) {
                hand[hand.length - 1]!.push(midi);
            } else {
                hand.push([midi]);
            }
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
        for (const note of doc.querySelectorAll("note")) {
            const midi = midiOf(note);
            if (midi === null) {
                continue;
            }
            const hand = note.querySelector("staff")?.textContent?.trim() === "2" ? left : right;
            if (note.querySelector("chord") && hand.length > 0) {
                hand[hand.length - 1]!.push(midi);
            } else {
                hand.push([midi]);
            }
        }
    }
    return { right, left };
}

function handEffort(positions: number[][], hand: "left" | "right"): number {
    if (positions.length === 0) {
        return 0;
    }
    return positionsCost(positions, fingerPositions(positions, hand), hand);
}

// The playing effort of already-parsed hands: total fingering cost across both,
// averaged over every note — so length doesn't inflate it and a short hard piece
// outranks a long easy one. Returns 0 for no notes, which callers must read as
// "nothing to measure" rather than "easiest", since a gentle in-hand line also
// costs ~0.
function effortOf(right: number[][], left: number[][]): number {
    const notes = right.length + left.length;
    if (notes === 0) {
        return 0;
    }
    return (handEffort(right, "right") + handEffort(left, "left")) / notes;
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
function readPace(doc: Document): { notesPerSecond: number; voices: number } {
    let divisions = 1;
    let tempo = 0;
    const beats: number[] = [];
    // Distinct voice numbers seen per staff — two lines in one hand, not two hands.
    const voicesByStaff = new Map<string, Set<string>>();
    for (const node of doc.querySelectorAll("divisions, sound, note")) {
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
        const staff = node.querySelector("staff")?.textContent?.trim() ?? "1";
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
    const { right, left } = parsePositions(codec, xml);
    // Nothing FINGERABLE means nothing to measure; callers read 0 that way, and a pace
    // term added to it would dress an unreadable import up as a plausible score. Note
    // that this is emptiness, not cheapness: a real line that happens to cost nothing to
    // finger — a repeated note, a gentle in-hand phrase — still has a speed and a
    // texture, and reading its effort of 0 as "nothing here" would silently drop both.
    if (right.length + left.length === 0) {
        return 0;
    }
    return effortOf(right, left) + paceCost(readPace(doc));
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

// The cost breakpoints between grades 1–8, calibrated PER category so each is
// graded on its own scale — otherwise every finger exercise lands below the
// easiest piece (scales/arpeggios cost more to finger than a stepwise tune). The
// `piece` breakpoints are the octiles of the curated PDMX song corpus (≈3,100
// pieces), so real pieces spread evenly across grades 1–8; re-derive them with
// `npm run songs:import` if the corpus changes. Scale/arpeggio remain measured
// against the beginner exercises (scales ~0.6–1.1, arpeggios ~1.3–1.8).
const GRADE_THRESHOLDS: Record<Category, number[]> = {
    piece: [2.263, 3.136, 3.867, 4.664, 5.623, 6.862, 8.76],
    scale: [0.8, 1.0, 1.2, 1.5, 1.8, 2.1, 2.4],
    arpeggio: [1.4, 1.6, 1.9, 2.2, 2.5, 2.8, 3.1],
};

const gradeCache = new Map<string, number>();

// A score's 1–8 grade: its fingering-cost difficulty placed against its category's
// thresholds. Memoised by id, which MUST be the content fingerprint (songId): the cache
// trusts the id to identify the notes and never re-reads xml on a hit, so a caller keying
// by anything else — a title slug, say — makes distinct scores collide onto one grade.
export function gradeOf(codec: XmlCodec, id: string, xml: string): number {
    const cached = gradeCache.get(id);
    if (cached !== undefined) {
        return cached;
    }
    const { right, left } = parsePositions(codec, xml);
    // No fingerable notes means an empty or unreadable score, not the gentlest
    // piece — a real in-hand line also costs ~0. Grade it at the top so it can't
    // pad the beginner pools, distinguishing it from a measured-easy cost of 0.
    if (right.length + left.length === 0) {
        gradeCache.set(id, MAX_GRADE);
        return MAX_GRADE;
    }
    const cost = rawDifficulty(codec, xml);
    let grade = 1;
    for (const threshold of GRADE_THRESHOLDS[categoryOf(id)]) {
        if (cost <= threshold) {
            break;
        }
        grade += 1;
    }
    gradeCache.set(id, grade);
    return grade;
}
