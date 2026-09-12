// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { pianoParts, stavesOf } from "./accompaniment";
import { spellChordPitch } from "./chordSpelling";
import { type ChordSpan, readHarmony } from "./harmony";
import { readTimeline } from "./musicxmlTimeline";
import { chordPitches, pitchClassOf } from "./theory";
import type { XmlCodec } from "./xml";

// The piece with its left hand played as block chords.
//
// This is what a teacher does with an accompaniment somebody cannot manage yet: keep the
// tune as written and play the harmony under it as plain chords, one per change, so the
// shape of the piece is learned before the pattern that decorates it. An Alberti bass, a
// broken chord, a waltz bass — all of them are a chord the hand can hold, and holding it
// first is how the pattern later falls under the fingers.
//
// Unlike the thinnings in core/simplify this writes notes the composer did not: the
// right hand is the composer's, the left hand is the harmony reader's, and a run against
// it is practice toward the piece rather than the piece. Every chord is voiced as a
// triad in the octave below middle C, bass note lowest, so the hand never opens past an
// octave. A beat the reader is not sure of still gets its best guess — a hand needs
// something to play — and a beat where nothing sounds gets a rest.

const LEFT_VOICE = "5";
// Where the left hand's chords sit when the hand has no notes to say: C3 up to B3, a
// comfortable octave for a triad.
const LEFT_OCTAVE_BOTTOM = 48;

type Segment = { ticks: number; span: ChordSpan | null };

export function blockChords(codec: XmlCodec, xml: string): string {
    const doc = codec.parse(xml);
    if (!doc) {
        return xml;
    }
    const parts = pianoParts(doc);
    // The left hand is its own part, or the second staff of a two-staff part. A piano
    // written on one staff has no left hand to block. The piano is asked for its own staff
    // count: on an art song it is not the score's first part.
    const ownPart = parts.length === 2;
    const leftPart = ownPart ? parts[1] : parts[0];
    if (!leftPart || (!ownPart && stavesOf(leftPart) < 2)) {
        return xml;
    }
    const staffNumber = ownPart ? null : 2;
    const timeline = readTimeline(doc);
    const spans = readHarmony(timeline);
    // Where the composer's left hand actually sounds. The chords go there and nowhere
    // else: a pickup the right hand plays alone, or a bar the left hand rests through,
    // stays silent rather than gaining a chord read off the tune.
    const leftNotes = timeline.notes.filter(
        (note) =>
            note.part === leftPart.getAttribute("id") &&
            note.staff === (staffNumber ?? 1) &&
            note.midi !== null &&
            note.wholes > 0,
    );
    const sounding = merged(
        leftNotes.map((note) => ({ from: note.whole, to: note.whole + note.wholes })),
    );
    // The chords sit where the composer's hand sat: the octave whose bottom is just under
    // the middle of what the left hand plays, so a low bass line stays low and a high
    // accompaniment stays high.
    const bottom = registerOf(leftNotes.map((note) => note.midi as number));
    const measures = Array.from(leftPart.children).filter((child) => child.tagName === "measure");
    let divisions = 1;
    for (const [index, measure] of measures.entries()) {
        const declared = measure.querySelector("attributes > divisions")?.textContent;
        if (declared) {
            divisions = Math.max(1, Number(declared) || divisions);
        }
        const from = timeline.measureStarts[index];
        if (from === undefined) {
            continue;
        }
        const to = timeline.measureStarts[index + 1] ?? timeline.end;
        if (to <= from) {
            continue;
        }
        clearLeftHand(measure, staffNumber);
        const ticksPerWhole = divisions * 4;
        const back = cursorAt(measure);
        if (back > 0) {
            measure.appendChild(backup(doc, back));
        }
        for (const segment of segmentsOf(spans, sounding, from, to, ticksPerWhole)) {
            for (const piece of splitTicks(segment.ticks, divisions)) {
                appendChord(doc, measure, segment.span, piece, divisions, staffNumber, bottom);
            }
        }
    }
    return codec.serialize(doc);
}

// The stretches the hand is sounding at all, note lengths joined: what matters is where it
// falls silent and comes back, not where one note hands over to the next.
function merged(played: readonly { from: number; to: number }[]): { from: number; to: number }[] {
    const sorted = [...played].sort((a, b) => a.from - b.from);
    const out: { from: number; to: number }[] = [];
    for (const one of sorted) {
        const last = out[out.length - 1];
        if (last && one.from <= last.to + EPSILON) {
            last.to = Math.max(last.to, one.to);
        } else {
            out.push({ ...one });
        }
    }
    return out;
}

// Take the left hand's notes out of the measure, and every backup or forward that was
// only there to reach them.
function clearLeftHand(measure: Element, staffNumber: number | null): void {
    const isLeft = (note: Element) =>
        staffNumber === null ||
        Number(note.querySelector("staff")?.textContent?.trim() ?? "1") === staffNumber;
    for (const note of Array.from(measure.children)) {
        if (note.tagName === "note" && isLeft(note)) {
            note.remove();
        }
    }
    // A backup or forward with no note between it and the next one (or the end) moved
    // the cursor for notes that are no longer there.
    const children = Array.from(measure.children);
    for (const [at, child] of children.entries()) {
        if (child.tagName !== "backup" && child.tagName !== "forward") {
            continue;
        }
        let note = false;
        for (let next = at + 1; next < children.length; next++) {
            const tag = children[next]?.tagName;
            if (tag === "backup" || tag === "forward") {
                break;
            }
            if (tag === "note") {
                note = true;
                break;
            }
        }
        if (!note) {
            child.remove();
        }
    }
}

// Where the measure's cursor stands after what is left in it, in ticks.
function cursorAt(measure: Element): number {
    let at = 0;
    for (const child of Array.from(measure.children)) {
        const duration = Number(child.querySelector(":scope > duration")?.textContent ?? "0");
        if (child.tagName === "note") {
            if (child.querySelector("chord") || child.querySelector("grace")) {
                continue;
            }
            at += duration;
        } else if (child.tagName === "backup") {
            at -= duration;
        } else if (child.tagName === "forward") {
            at += duration;
        }
    }
    return Math.max(0, at);
}

function backup(doc: Document, ticks: number): Element {
    const element = doc.createElement("backup");
    const duration = doc.createElement("duration");
    duration.textContent = String(ticks);
    element.appendChild(duration);
    return element;
}

// The measure cut at every chord change inside it, each piece with the chord in force.
function segmentsOf(
    spans: readonly ChordSpan[],
    sounding: readonly { from: number; to: number }[],
    from: number,
    to: number,
    ticksPerWhole: number,
): Segment[] {
    const edges = new Set<number>([from, to]);
    for (const span of spans) {
        for (const edge of [span.from, span.to]) {
            if (edge > from + EPSILON && edge < to - EPSILON) {
                edges.add(edge);
            }
        }
    }
    // A chord is cut where the left hand falls silent or comes back in, too, so the
    // silence is exactly the composer's.
    for (const played of sounding) {
        for (const edge of [played.from, played.to]) {
            if (edge > from + EPSILON && edge < to - EPSILON) {
                edges.add(edge);
            }
        }
    }
    const sorted = [...edges].sort((a, b) => a - b);
    const segments: Segment[] = [];
    let used = 0;
    const total = Math.round((to - from) * ticksPerWhole);
    for (let at = 0; at < sorted.length - 1; at++) {
        const start = sorted[at] as number;
        const end = sorted[at + 1] as number;
        // Rounded against the running total, so the pieces add up to the bar exactly.
        const ticks = Math.round((end - from) * ticksPerWhole) - used;
        used += ticks;
        if (ticks <= 0) {
            continue;
        }
        const played = sounding.some((one) => one.from < end - EPSILON && one.to > start + EPSILON);
        const span = played
            ? (spans.find((one) => one.from <= start + EPSILON && one.to > start + EPSILON) ?? null)
            : null;
        const last = segments[segments.length - 1];
        // Silence is silence: two chord changes over a resting hand are one rest.
        if (span === null && last !== undefined && last.span === null) {
            last.ticks += ticks;
        } else {
            segments.push({ ticks, span });
        }
    }
    if (used < total) {
        const last = segments[segments.length - 1];
        if (last !== undefined && last.span === null) {
            last.ticks += total - used;
        } else {
            segments.push({ ticks: total - used, span: null });
        }
    }
    return segments;
}

const EPSILON = 1e-6;

// A length as note values, longest first: a five-beat chord is a whole and a quarter.
function splitTicks(ticks: number, divisions: number): number[] {
    const values = [4, 3, 2, 1.5, 1, 0.75, 0.5, 0.375, 0.25, 0.125].map((quarters) =>
        Math.round(quarters * divisions),
    );
    const pieces: number[] = [];
    let left = ticks;
    while (left > 0) {
        const piece = values.find((value) => value > 0 && value <= left) ?? left;
        pieces.push(piece);
        left -= piece;
    }
    return pieces;
}

function typeOf(ticks: number, divisions: number): { type: string; dot: boolean } {
    const quarters = ticks / divisions;
    const named: [number, string, boolean][] = [
        [4, "whole", false],
        [3, "half", true],
        [2, "half", false],
        [1.5, "quarter", true],
        [1, "quarter", false],
        [0.75, "eighth", true],
        [0.5, "eighth", false],
        [0.375, "16th", true],
        [0.25, "16th", false],
        [0.125, "32nd", false],
    ];
    for (const [value, type, dot] of named) {
        if (Math.abs(quarters - value) < 1e-6) {
            return { type, dot };
        }
    }
    return { type: "quarter", dot: false };
}

// Where the chords' bass notes go: a little under the middle of what the hand plays, so
// the block, which reaches up from its bass, sits where the pattern it replaces sat.
function registerOf(midis: readonly number[]): number {
    if (midis.length === 0) {
        return LEFT_OCTAVE_BOTTOM + 4;
    }
    const sorted = [...midis].sort((a, b) => a - b);
    const middle = sorted[Math.floor(sorted.length / 2)] as number;
    return Math.max(28, middle - 4);
}

// The placement of a pitch class nearest a target note, the lower on a tie.
function nearest(pitchClass: number, target: number): number {
    const below = target - ((((target - pitchClass) % 12) + 12) % 12);
    const above = below + 12;
    return above - target < target - below ? above : below;
}

// The chord's tones in the hand's octave, the bass note lowest: a triad as it is, and a
// seventh chord as its shell — root, third and seventh — since the seventh is the note
// the symbol names and the fifth is the one a hand can spare.
function voicing(span: ChordSpan, target: number): number[] {
    const stack = chordPitches(span.root, span.quality).map(pitchClassOf);
    const tones = (stack.length >= 4 ? [stack[0], stack[1], stack[3]] : stack.slice(0, 3)).filter(
        (tone): tone is number => tone !== undefined,
    );
    const bass = tones.includes(span.bass) ? span.bass : span.root;
    const bottom = nearest(bass, target);
    const above = tones
        .filter((tone) => tone !== bass)
        .map((tone) => bottom + ((tone - bass + 12) % 12))
        .sort((a, b) => a - b);
    return [bottom, ...above];
}

function appendChord(
    doc: Document,
    measure: Element,
    span: ChordSpan | null,
    ticks: number,
    divisions: number,
    staffNumber: number | null,
    bottomOfOctave: number,
): void {
    const { type, dot } = typeOf(ticks, divisions);
    const pitches = span === null ? [] : voicing(span, bottomOfOctave);
    const notes = pitches.length === 0 ? [null] : pitches;
    for (const [index, midi] of notes.entries()) {
        const note = doc.createElement("note");
        if (index > 0) {
            note.appendChild(doc.createElement("chord"));
        }
        if (midi === null || span === null) {
            note.appendChild(doc.createElement("rest"));
        } else {
            // The chord's own spelling, so the notes on the staff match its symbol.
            const spelled = spellChordPitch(span, midi);
            const pitch = doc.createElement("pitch");
            const step = doc.createElement("step");
            step.textContent = spelled.step;
            pitch.appendChild(step);
            if (spelled.alter !== 0) {
                const alter = doc.createElement("alter");
                alter.textContent = String(spelled.alter);
                pitch.appendChild(alter);
            }
            const octave = doc.createElement("octave");
            octave.textContent = String(spelled.octave);
            pitch.appendChild(octave);
            note.appendChild(pitch);
        }
        const duration = doc.createElement("duration");
        duration.textContent = String(ticks);
        note.appendChild(duration);
        const voice = doc.createElement("voice");
        voice.textContent = LEFT_VOICE;
        note.appendChild(voice);
        const typeElement = doc.createElement("type");
        typeElement.textContent = type;
        note.appendChild(typeElement);
        if (dot) {
            note.appendChild(doc.createElement("dot"));
        }
        if (staffNumber !== null) {
            const staff = doc.createElement("staff");
            staff.textContent = String(staffNumber);
            note.appendChild(staff);
        }
        measure.appendChild(note);
    }
}
