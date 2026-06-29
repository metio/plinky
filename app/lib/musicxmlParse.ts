// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { Composition, RecordedNote } from "./composition";

// Reads MusicXML back into a composition, the inverse of the toMusicXml sketch, so a
// score downloaded on one device — or exported from notation software — can be loaded
// into compose and played or extended. It walks the first part in document order,
// advancing a divisions clock through notes, rests, chords and the backup/forward
// jumps that stack two staves into one measure, and merges tied notes into one held
// sound.

const STEP_SEMITONES: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const DEFAULT_TEMPO = 120;
const DEFAULT_BEATS_PER_BAR = 4;
const DEFAULT_VELOCITY = 90;

function text(parent: Element, selector: string): string | null {
    return parent.querySelector(selector)?.textContent?.trim() ?? null;
}

function midiOf(pitch: Element): number | null {
    const step = text(pitch, "step");
    const octave = text(pitch, "octave");
    if (step === null || octave === null || STEP_SEMITONES[step] === undefined) {
        return null;
    }
    const alter = Number(text(pitch, "alter") ?? "0");
    return (Number(octave) + 1) * 12 + STEP_SEMITONES[step]! + alter;
}

// Parses MusicXML text into a composition, or null if it holds no readable score. The
// document's first tempo and time signature set the grid; everything is timed in
// milliseconds from the first note so it drops straight into the recorded timeline.
export function parseMusicXml(xml: string): Composition | null {
    let doc: Document;
    try {
        doc = new DOMParser().parseFromString(xml, "application/xml");
    } catch {
        return null;
    }
    if (doc.querySelector("parsererror") || !doc.querySelector("score-partwise")) {
        return null;
    }
    const part = doc.querySelector("part");
    if (!part) {
        return null;
    }

    let divisions = Number(text(doc.documentElement, "divisions") ?? "1") || 1;
    const tempoAttr = doc.querySelector("sound[tempo]")?.getAttribute("tempo");
    const perMinute = text(doc.documentElement, "per-minute");
    const tempo = Number(tempoAttr ?? perMinute ?? DEFAULT_TEMPO) || DEFAULT_TEMPO;
    const beats = Number(text(doc.documentElement, "time > beats") ?? DEFAULT_BEATS_PER_BAR);
    const beatsPerBar = beats > 0 ? beats : DEFAULT_BEATS_PER_BAR;

    // Notes accrued in quarter notes — a divisions-independent clock. `divisions` is
    // the number of duration units per quarter note and a measure may restate it, so
    // converting each duration to quarters as it's read keeps the notes already placed
    // at their true time; a single end-of-piece scale would stretch every earlier
    // section by whatever the final measure happened to declare. Tied notes are
    // stretched in place via this index.
    type Building = {
        midi: number;
        startQuarters: number;
        durationQuarters: number;
        velocity: number;
    };
    const built: Building[] = [];
    // The note currently extending a tie, per pitch, so its stop half lengthens it.
    const openTies = new Map<number, Building>();

    let cursor = 0; // absolute time in quarter notes
    let lastStart = 0; // onset of the previous non-chord note, for chord members

    for (const measure of part.querySelectorAll("measure")) {
        // A measure may restate the divisions-per-quarter for the notes that follow.
        const measureDivisions = text(measure, "divisions");
        if (measureDivisions) {
            divisions = Number(measureDivisions) || divisions;
        }
        // Durations are written in divisions of the quarter note currently in force.
        const toQuarters = (divs: number) => divs / divisions;
        for (const element of measure.children) {
            if (element.tagName === "backup") {
                cursor -= toQuarters(Number(text(element, "duration") ?? "0"));
            } else if (element.tagName === "forward") {
                cursor += toQuarters(Number(text(element, "duration") ?? "0"));
            } else if (element.tagName === "note") {
                const durationQuarters = toQuarters(Number(text(element, "duration") ?? "0"));
                const isChord = element.querySelector("chord") !== null;
                const start = isChord ? lastStart : cursor;
                const pitch = element.querySelector("pitch");
                const isRest = element.querySelector("rest") !== null;
                if (!isRest && pitch) {
                    const midi = midiOf(pitch);
                    if (midi !== null) {
                        const tieStop = element.querySelector('tie[type="stop"]') !== null;
                        const tieStart = element.querySelector('tie[type="start"]') !== null;
                        const held = tieStop ? openTies.get(midi) : undefined;
                        if (held) {
                            // Extend the held note through this tied continuation.
                            held.durationQuarters = start + durationQuarters - held.startQuarters;
                            if (tieStart) {
                                openTies.set(midi, held);
                            } else {
                                openTies.delete(midi);
                            }
                        } else {
                            const note: Building = {
                                midi,
                                startQuarters: start,
                                durationQuarters,
                                velocity: DEFAULT_VELOCITY,
                            };
                            built.push(note);
                            if (tieStart) {
                                openTies.set(midi, note);
                            }
                        }
                    }
                }
                // Chord members sound atop the previous note and don't move the clock.
                if (!isChord) {
                    lastStart = cursor;
                    cursor += durationQuarters;
                }
            }
        }
    }

    if (built.length === 0) {
        return null;
    }

    const msPerQuarter = 60_000 / tempo;
    built.sort((a, b) => a.startQuarters - b.startQuarters);
    const origin = built[0]!.startQuarters;
    const notes: RecordedNote[] = built.map((note) => ({
        pitch: note.midi,
        startMs: (note.startQuarters - origin) * msPerQuarter,
        durationMs: Math.max(1, note.durationQuarters * msPerQuarter),
        velocity: note.velocity,
    }));
    return { notes, tempo, beatsPerBar };
}
