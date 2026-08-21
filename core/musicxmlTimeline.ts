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
    // What the file writes over this note. All of it optional in the format and most of it
    // absent in most scores, so every field has a quiet default rather than a null to
    // branch on at each use.
    marks: XmlNoteMarks;
};

export type XmlNoteMarks = {
    articulation: "none" | "staccato" | "staccatissimo" | "tenuto" | "detachedLegato";
    accent: boolean;
    marcato: boolean;
    fermata: boolean;
    ornament: "trill" | "turn" | "inverted-turn" | "mordent" | "inverted-mordent" | null;
    arpeggiate: boolean;
    // Slur numbers starting and stopping here. MusicXML numbers its slurs so two arches can
    // overlap — one per hand, or nested phrasing — and pairing by number is what keeps them
    // from closing each other.
    slurStarts: string[];
    slurStops: string[];
};

const NO_MARKS: XmlNoteMarks = {
    articulation: "none",
    accent: false,
    marcato: false,
    fermata: false,
    ornament: null,
    arpeggiate: false,
    slurStarts: [],
    slurStops: [],
};

// The length articulations are mutually exclusive; the shortest written wins, which is what
// an engraver means by writing two.
const ARTICULATION_ORDER: XmlNoteMarks["articulation"][] = [
    "staccatissimo",
    "staccato",
    "detachedLegato",
    "tenuto",
];

const ORNAMENT_TAGS: Record<string, NonNullable<XmlNoteMarks["ornament"]>> = {
    "trill-mark": "trill",
    turn: "turn",
    "inverted-turn": "inverted-turn",
    // A delayed turn waits before it starts; the wait is a nuance this does not model, and
    // playing it as a turn is far closer than not playing it.
    "delayed-turn": "turn",
    "delayed-inverted-turn": "inverted-turn",
    mordent: "mordent",
    "inverted-mordent": "inverted-mordent",
};

function marksOf(note: Element): XmlNoteMarks {
    const notations = note.getElementsByTagName("notations");
    if (notations.length === 0) {
        return NO_MARKS;
    }
    const has = (name: string) => note.getElementsByTagName(name).length > 0;
    const articulation =
        ARTICULATION_ORDER.find((one) =>
            has(one === "detachedLegato" ? "detached-legato" : one),
        ) ?? "none";
    const ornamentTag = Object.keys(ORNAMENT_TAGS).find((tag) => has(tag));
    const slurs = Array.from(note.getElementsByTagName("slur"));
    return {
        articulation,
        accent: has("accent"),
        marcato: has("strong-accent"),
        fermata: has("fermata"),
        ornament: ornamentTag ? ORNAMENT_TAGS[ornamentTag] ?? null : null,
        arpeggiate: has("arpeggiate"),
        slurStarts: slurs
            .filter((slur) => slur.getAttribute("type") === "start")
            .map((slur) => slur.getAttribute("number") ?? "1"),
        slurStops: slurs
            .filter((slur) => slur.getAttribute("type") === "stop")
            .map((slur) => slur.getAttribute("number") ?? "1"),
    };
}

export type XmlTimeline = {
    notes: XmlNote[];
    // Where each printed measure begins, in whole notes.
    measureStarts: number[];
    // Every `<direction>` in the document, stamped with where the measure's cursor had
    // reached when it was met.
    //
    // Stamped here rather than found again later because working out that onset is the
    // fiddly part — divisions, backups, chords that do not advance, grace notes that take
    // no time — and doing it twice means two implementations that can disagree. If they
    // did, every dynamic in the piece would sit at a different moment from the notes it
    // belongs to, which is a wrongness nothing would report.
    directions: { element: Element; whole: number }[];
    // How far the music runs, for a marking the engraving opens and never closes.
    end: number;
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
    const directions: { element: Element; whole: number }[] = [];
    let end = 0;
    if (!root) {
        return { notes, measureStarts, directions, end };
    }

    for (const part of partsOf(root, wanted)) {
        // Divisions are ticks per crotchet, declared in the first measure and changeable
        // later; a file that never declares them is broken, and one tick per crotchet at
        // least keeps the arithmetic finite.
        let divisions = 1;
        // What a bar of this metre is worth, in whole notes — three-four is 0.75. Null
        // until the file states a time signature, which every real engraving does in its
        // first measure.
        let barWholes: number | null = null;
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
            const time = child(measure, "time");
            if (time) {
                const beats = numberOf(child(time, "beats"), 0);
                const beatType = numberOf(child(time, "beat-type"), 0);
                barWholes = beats > 0 && beatType > 0 ? beats / beatType : barWholes;
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
                if (tag === "direction") {
                    directions.push({
                        element,
                        whole: (measureStarts[index] as number) + atTicks / perWhole,
                    });
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
                const rest = child(element, "rest") !== null;
                const onsetTicks = chord ? lastOnsetTicks : atTicks;

                notes.push({
                    whole: (measureStarts[index] as number) + onsetTicks / perWhole,
                    wholes: durationTicks / perWhole,
                    midi: rest ? null : midiOf(element),
                    voice: text(child(element, "voice")) || "1",
                    staff: Math.max(1, numberOf(child(element, "staff"), 1)),
                    chord,
                    grace,
                    tie: tieOf(element),
                    measure: index,
                    marks: marksOf(element),
                });

                if (!chord) {
                    lastOnsetTicks = atTicks;
                    atTicks += durationTicks;
                    furthest = Math.max(furthest, atTicks);
                }
            }
            // How far the bar carries the music on: what the metre says a bar is worth.
            //
            // NOT how far the writing reaches, which is what the engraver believes and is
            // wrong to. Engravings overrun their own barlines in two ordinary ways — a
            // whole-measure rest written at a whole note's length whatever the metre, and
            // a voice written past the barline and wound back with a `<backup>` — and
            // taking either at its word puts every bar after it late, by a little more
            // each time, until a piece is minutes out from itself.
            //
            // A bar that stops SHORT of its metre is left alone, and that asymmetry is
            // deliberate. An overrun is the file contradicting itself — the same engraving
            // that wrote a whole note into a two-four bar winds the cursor back to the
            // barline afterwards — so the metre settles it. A short bar contradicts
            // nothing: it is a bar with less music written in it than the metre allows,
            // and whether the missing beat is silence the composer wanted or a beat the
            // transcriber dropped is not something a reader can know. Forty-three bars in
            // eighteen hundred are short, of which five are pickups and twenty-three sit
            // mid-piece in files that are simply misnotated. Padding those would be
            // guessing, and guessing loudly, in a place where the guess is audible.
            const content = furthest / perWhole;
            partStart =
                (measureStarts[index] as number) +
                (barWholes === null ? content : Math.min(content, barWholes));
            end = Math.max(end, partStart);
        });
    }

    // One part may be shorter than another — a pickup written into only one staff, or an
    // engraving that simply stops. Reading in printed order and sorting afterwards keeps
    // every part's notes on one timeline without assuming they agree about the length of
    // anything.
    notes.sort((one, other) => one.whole - other.whole || one.staff - other.staff);
    directions.sort((one, other) => one.whole - other.whole);
    return { notes, measureStarts, directions, end };
}
