// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The marks that belong to a stretch of music rather than to one note, read from the file.
//
// A dynamic, a pedal line, an 8va bracket and a slur all mean "from here to there", and all
// four were previously lifted out of the engraver's object graph — which reports them in
// four different shapes, none of them documented, on classes the shipped bundle renames to
// single letters. Here they come off the document, where they are four instances of one
// idea: something written at a position, standing until something else ends it.

import type { DynamicPoint } from "./dynamics";
import { DEFAULT_VELOCITY } from "./expression";
import type { OctaveShiftSpan } from "./octaveShift";
import type { PedalSpan } from "./pedal";
import type { SlurSpan } from "./slur";
import { readTimeline, type XmlNote, type XmlTimeline } from "./musicxmlTimeline";

// The loudness each written dynamic asks for, as a MIDI velocity. The values a sequencer
// conventionally uses, which is also the range the app's own default sits in.
const DYNAMIC_VELOCITY: Record<string, number> = {
    pppp: 10,
    ppp: 16,
    pp: 33,
    p: 49,
    mp: 64,
    mf: 80,
    f: 96,
    ff: 112,
    fff: 126,
    ffff: 127,
    // The accented ones are a loud attack rather than a standing level, but they are
    // written where a level would be, and reading them as loud is much closer than
    // ignoring them.
    sf: 112,
    sfz: 112,
    fz: 112,
    rf: 96,
    rfz: 96,
    fp: 96,
};

const text = (element: Element | null | undefined): string => element?.textContent?.trim() ?? "";
const child = (parent: Element, name: string): Element | null =>
    parent.getElementsByTagName(name)[0] ?? null;

// The arches, paired by the number the file gives them.
//
// Pairing by number rather than by order is what lets two arches overlap — one per hand, or
// a phrase inside a phrase — without closing each other. A file that numbers nothing gets
// "1" for everything, which is the single-arch case and pairs correctly.
export function slurSpans(notes: readonly XmlNote[]): SlurSpan[] {
    const spans: SlurSpan[] = [];
    const open = new Map<string, number>();
    for (const note of notes) {
        for (const number of note.marks.slurStarts) {
            if (!open.has(number)) {
                open.set(number, note.whole);
            }
        }
        for (const number of note.marks.slurStops) {
            const from = open.get(number);
            if (from !== undefined) {
                spans.push({ from, to: note.whole });
                open.delete(number);
            }
        }
    }
    // An arch the engraving opens and never closes joins to the last note it opened over.
    // Dropping it would play the phrase detached, which is silent as failures go.
    const last = notes.at(-1)?.whole ?? 0;
    for (const from of open.values()) {
        spans.push({ from, to: Math.max(from, last) });
    }
    return spans;
}

// Everything written as a `<direction>`: the dynamics, the pedal, the octave lines.
//
// The onsets are the timeline's, stamped as it walked. A direction sits inside a measure
// between the notes it applies from, and working out where that is means following
// divisions, backups, chord notes that do not advance and grace notes that take no time —
// so it is done once, where the notes are placed, rather than again here.
export type XmlDirections = {
    dynamics: DynamicPoint[];
    pedals: PedalSpan[];
    octaveShifts: OctaveShiftSpan[];
};

export function readDirections(timeline: XmlTimeline): XmlDirections {
    const dynamics: DynamicPoint[] = [];
    const pedals: PedalSpan[] = [];
    const octaveShifts: OctaveShiftSpan[] = [];
    // What is currently open. One object rather than a handful of variables, so the
    // per-direction reader below can be a plain function instead of a closure over this one.
    const open: OpenSpans = {
        pedal: null,
        shift: null,
        end: timeline.end,
        volume: DEFAULT_VELOCITY,
    };

    for (const { element, whole } of timeline.directions) {
        readDirection(element, whole, { dynamics, pedals, octaveShifts }, open);
    }

    // A line the engraving opens and never closes runs to the end of the music, rather than
    // being dropped — dropping it un-pedals (or un-shifts) the rest of the piece silently.
    if (open.pedal !== null) {
        pedals.push({ from: open.pedal, to: Math.max(open.pedal, open.end) });
    }
    if (open.shift !== null) {
        octaveShifts.push({
            from: open.shift.at,
            to: Math.max(open.shift.at, open.end),
            semitones: open.shift.semitones,
        });
    }
    return { dynamics, pedals, octaveShifts };
}

type OpenSpans = {
    pedal: number | null;
    shift: { at: number; semitones: number } | null;
    end: number;
    // The loudness in force, so a hairpin knows what it is swelling from.
    volume: number;
};

function readDirection(
    direction: Element,
    at: number,
    out: XmlDirections,
    open: OpenSpans,
): void {
    for (const type of Array.from(direction.getElementsByTagName("direction-type"))) {
        const dynamic = child(type, "dynamics");
        if (dynamic) {
            for (const mark of Array.from(dynamic.children)) {
                const volume = DYNAMIC_VELOCITY[mark.tagName];
                if (volume !== undefined) {
                    out.dynamics.push({ whole: at, volume, ramp: false });
                    open.volume = volume;
                }
            }
        }
        const wedge = child(type, "wedge");
        if (wedge) {
            const kind = wedge.getAttribute("type");
            // A hairpin's start is where the loudness begins to slide, and the mark it
            // slides TOWARD is whatever is written next — which is why this is a ramp flag
            // on a point rather than a span of its own.
            //
            // It carries the loudness the swell begins FROM, which is whatever was already
            // in force. A hairpin does not itself say how loud anything is; it says the
            // loudness changes from here. Where nothing precedes it the swell still has to
            // start somewhere, and the default is where a player would start.
            if (kind === "crescendo" || kind === "diminuendo") {
                out.dynamics.push({ whole: at, volume: open.volume, ramp: true });
            }
        }
        const pedal = child(type, "pedal");
        if (pedal) {
            const kind = pedal.getAttribute("type");
            if ((kind === "start" || kind === "sostenuto") && open.pedal === null) {
                open.pedal = at;
            } else if (open.pedal !== null && (kind === "stop" || kind === "change")) {
                out.pedals.push({ from: open.pedal, to: at });
                // A change lifts and presses on the spot — the span ends and another begins
                // at the same moment, which is what clears the old harmony. A stop just
                // ends.
                open.pedal = kind === "change" ? at : null;
            }
        }
        const shift = child(type, "octave-shift");
        if (shift) {
            const kind = shift.getAttribute("type");
            const size = Number(shift.getAttribute("size") ?? "8");
            // size 8 is one octave, 15 is two — the numbers name the interval, counting
            // inclusively, which is why they are not 7 and 14.
            const octaves = size >= 15 ? 2 : 1;
            if ((kind === "up" || kind === "down") && open.shift === null) {
                open.shift = { at, semitones: (kind === "up" ? 12 : -12) * octaves };
            } else if (kind === "stop" && open.shift !== null) {
                out.octaveShifts.push({
                    from: open.shift.at,
                    to: at,
                    semitones: open.shift.semitones,
                });
                open.shift = null;
            }
        }
    }
}

// What a `<beat-unit>` is worth in crotchets, so a metronome mark written in anything else
// can be said in the unit everything downstream counts in.
const BEAT_UNIT_QUARTERS: Record<string, number> = {
    whole: 4,
    half: 2,
    quarter: 1,
    eighth: 0.5,
    "16th": 0.25,
};

// Where the piece changes speed, in crotchets per minute, at the moment it changes.
//
// The engraver could only answer this per measure — it resolves a tempo onto the bar the
// mark sits in — so a mark written mid-bar took effect at the barline before it. Thirteen
// files in a hundred in the catalogue write one, and in every one of them a rit. or an
// a tempo arrived early by up to a bar.
export function readTempoPoints(timeline: XmlTimeline): TempoPoint[] {
    const points: TempoPoint[] = [];
    for (const { element, whole } of timeline.directions) {
        // `<sound tempo>` is the sounding instruction and is always in crotchets; a
        // `<metronome>` is the printed one and says which note it is counting.
        const sound = element.tagName === "sound" ? element : child(element, "sound");
        const stated = Number(sound?.getAttribute("tempo") ?? Number.NaN);
        if (Number.isFinite(stated) && stated > 0) {
            points.push({ whole, bpm: stated });
            continue;
        }
        const metronome = child(element, "metronome");
        if (!metronome) {
            continue;
        }
        const perMinute = Number(text(child(metronome, "per-minute")));
        const unit = BEAT_UNIT_QUARTERS[text(child(metronome, "beat-unit"))] ?? 1;
        // A dot on the beat unit makes it half as long again — a dotted crotchet in 6/8.
        const dotted = metronome.getElementsByTagName("beat-unit-dot").length > 0 ? 1.5 : 1;
        if (Number.isFinite(perMinute) && perMinute > 0) {
            points.push({ whole, bpm: perMinute * unit * dotted });
        }
    }
    return points;
}

export type TempoPoint = {
    whole: number;
    // Crotchets per minute, whatever note the mark was written against.
    bpm: number;
};

// The tempo in force at a printed position, or null where the piece has stated none yet.
export function tempoAt(points: readonly TempoPoint[], whole: number): number | null {
    let found: number | null = null;
    for (const point of points) {
        if (point.whole <= whole + 1e-9) {
            found = point.bpm;
        }
    }
    return found;
}


// The key signature the piece opens in, as its count of sharps (positive) or flats.
export function readFifths(doc: Document): number {
    const fifths = doc.documentElement?.getElementsByTagName("fifths")[0];
    const value = Number(text(fifths));
    return Number.isFinite(value) ? value : 0;
}

// Everything a surface needs to know about a score's markings, read once.
//
// The readers above each answer one question, which is right for testing them and wrong
// for using them: a caller wants the whole set, and asking for it in five calls means five
// chances to forget one. The dynamics reader was forgotten for years in exactly that way.
export type ScoreMarks = {
    slurs: SlurSpan[];
    pedals: PedalSpan[];
    octaveShifts: OctaveShiftSpan[];
    dynamics: DynamicPoint[];
    tempi: TempoPoint[];
    fifths: number;
};

// A score with nothing written on it — which is also the honest answer for a caller that
// has no document to read, rather than a reason to branch at every use.
export const NO_SCORE_MARKS: ScoreMarks = {
    slurs: [],
    pedals: [],
    octaveShifts: [],
    dynamics: [],
    tempi: [],
    fifths: 0,
};

export function readScoreMarks(doc: Document | null): ScoreMarks {
    if (!doc) {
        return NO_SCORE_MARKS;
    }
    const timeline = readTimeline(doc);
    const directions = readDirections(timeline);
    return {
        slurs: slurSpans(timeline.notes),
        pedals: directions.pedals,
        octaveShifts: directions.octaveShifts,
        dynamics: directions.dynamics,
        tempi: readTempoPoints(timeline),
        fifths: readFifths(doc),
    };
}
