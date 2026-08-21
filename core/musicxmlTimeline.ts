// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Reading the music out of a MusicXML document, rather than out of the engraver.
//
// Everything Plinky needs to know about a piece — when each note starts, how long it
// lasts, which marks are written over it — is in the file. It has been read off the
// engraver instead because the engraver was already there, and that has cost a great deal:
// its object graph is undocumented and its shipped bundle is minified, so every fact is a
// guess confirmed only by loading a real score in a real browser. A mark read wrongly does
// not throw; it silently plays nothing. The dynamics reader returned null for every real
// score for years with a full suite of passing tests behind it.
//
// Read from the file instead and the whole class of failure goes: the format is specified,
// the parse is pure, and a test is a string in a node process rather than an engraving in
// a browser. The engraver keeps the job it is actually for — drawing the page, and telling
// us which pixels belong to which note.
//
// This module is the timeline: where every note sits and how long it lasts. The marks hang
// off it, because a mark's meaning is "from here to there" and `here` is an onset.

// Onsets and lengths are in whole notes, the unit the rest of the app already speaks: a
// crotchet is 0.25. Divisions are a per-file encoding detail and stop here.
export type XmlNote = {
    // From the top of the piece.
    whole: number;
    // The written length. Zero for a grace note, which steals its time from its neighbour.
    wholes: number;
    // Sounding pitch as MIDI, or null for a rest.
    midi: number | null;
    voice: string;
    // 1-based, as the file writes it.
    staff: number;
    // Sounds together with the note before it rather than after it.
    chord: boolean;
    grace: boolean;
    tie: "start" | "stop" | "both" | null;
    // 0-based index into the measures as printed.
    measure: number;
};

export type XmlTimeline = {
    notes: XmlNote[];
    // Where each printed measure begins, in whole notes.
    measureStarts: number[];
};

const STEP_SEMITONES: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

const text = (element: Element | null | undefined): string => element?.textContent?.trim() ?? "";

const numberOf = (element: Element | null | undefined, fallback: number): number => {
    const value = Number(text(element));
    return Number.isFinite(value) ? value : fallback;
};

const child = (parent: Element, name: string): Element | null =>
    parent.getElementsByTagName(name)[0] ?? null;

// A note's sounding pitch. MusicXML writes the letter, the octave and any alteration
// separately, and octave 4 is the one middle C sits in.
function midiOf(note: Element): number | null {
    const pitch = child(note, "pitch");
    if (!pitch) {
        return null;
    }
    const step = STEP_SEMITONES[text(child(pitch, "step")).toUpperCase()];
    if (step === undefined) {
        return null;
    }
    const octave = numberOf(child(pitch, "octave"), 4);
    const alter = numberOf(child(pitch, "alter"), 0);
    return (octave + 1) * 12 + step + alter;
}

function tieOf(note: Element): XmlNote["tie"] {
    // `<tie>` is the sounding instruction and `<tied>` the printed slur-like line; a file
    // may carry either, and for playback they mean the same thing.
    const types = new Set<string>();
    for (const name of ["tie", "tied"]) {
        for (const element of Array.from(note.getElementsByTagName(name))) {
            types.add(element.getAttribute("type") ?? "");
        }
    }
    if (types.has("start") && types.has("stop")) {
        return "both";
    }
    if (types.has("start")) {
        return "start";
    }
    return types.has("stop") ? "stop" : null;
}

// The parts whose notes are wanted. A piano piece is one part; an art song has a voice part
// too, and reading it as music for the hands would ask the player to sing.
function partsOf(root: Element, wanted?: (id: string) => boolean): Element[] {
    return Array.from(root.getElementsByTagName("part")).filter(
        (part) => !wanted || wanted(part.getAttribute("id") ?? ""),
    );
}

// Every note of the document, in printed order, with its onset.
//
// Printed order, not performance order: repeats are not expanded here. A repeat changes
// which positions are *visited* and in what sequence, and that is a separate problem from
// where each printed position sits — one that the matcher already solves against the
// printed timeline.
export function readTimeline(doc: Document, wanted?: (partId: string) => boolean): XmlTimeline {
    const root = doc.documentElement;
    const notes: XmlNote[] = [];
    const measureStarts: number[] = [];
    if (!root) {
        return { notes, measureStarts };
    }

    for (const part of partsOf(root, wanted)) {
        // Divisions are ticks per crotchet, declared in the first measure and changeable
        // later; a file that never declares them is broken, and one tick per crotchet at
        // least keeps the arithmetic finite.
        let divisions = 1;
        // Where this part has reached, in whole notes from the top.
        let partStart = 0;
        const measures = Array.from(part.getElementsByTagName("measure"));

        measures.forEach((measure, index) => {
            if (measureStarts[index] === undefined) {
                measureStarts[index] = partStart;
            }
            const declared = child(measure, "divisions");
            if (declared) {
                divisions = Math.max(1, numberOf(declared, divisions));
            }
            const perWhole = divisions * 4;
            // Ticks from the start of the measure. `<backup>` winds it back so a second
            // voice (the left hand) can be written after the first rather than interleaved.
            let atTicks = 0;
            let furthest = 0;
            // The onset the last non-chord note started at, so a `<chord/>` note joins it
            // instead of following it.
            let lastOnsetTicks = 0;

            for (const element of Array.from(measure.children)) {
                const tag = element.tagName;
                if (tag === "backup") {
                    atTicks = Math.max(0, atTicks - numberOf(child(element, "duration"), 0));
                    continue;
                }
                if (tag === "forward") {
                    atTicks += numberOf(child(element, "duration"), 0);
                    furthest = Math.max(furthest, atTicks);
                    continue;
                }
                if (tag !== "note") {
                    continue;
                }
                const grace = child(element, "grace") !== null;
                // A grace note is printed before the note it decorates and written with no
                // duration of its own, so it neither advances the measure nor claims time.
                const durationTicks = grace ? 0 : numberOf(child(element, "duration"), 0);
                const chord = child(element, "chord") !== null;
                const onsetTicks = chord ? lastOnsetTicks : atTicks;

                notes.push({
                    whole: (measureStarts[index] as number) + onsetTicks / perWhole,
                    wholes: durationTicks / perWhole,
                    midi: child(element, "rest") ? null : midiOf(element),
                    voice: text(child(element, "voice")) || "1",
                    staff: Math.max(1, numberOf(child(element, "staff"), 1)),
                    chord,
                    grace,
                    tie: tieOf(element),
                    measure: index,
                });

                if (!chord) {
                    lastOnsetTicks = atTicks;
                    atTicks += durationTicks;
                    furthest = Math.max(furthest, atTicks);
                }
            }
            partStart = (measureStarts[index] as number) + furthest / perWhole;
        });
    }

    // One part may be shorter than another — a pickup written into only one staff, or an
    // engraving that simply stops. Reading in printed order and sorting afterwards keeps
    // every part's notes on one timeline without assuming they agree about the length of
    // anything.
    notes.sort((one, other) => one.whole - other.whole || one.staff - other.staff);
    return { notes, measureStarts };
}
