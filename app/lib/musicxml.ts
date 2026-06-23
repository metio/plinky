// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// A small MusicXML → ABC converter for the subset the trainers play: notes,
// chords, rests, durations, accidentals, and a piano grand staff (two staves).
// It leans on the browser's DOMParser, so it runs at import time and in jsdom
// tests — no dependency, keeping the tree 0BSD. Richer MusicXML (dynamics,
// repeats, multiple parts, ties) is ignored; the converted ABC is then validated
// like any other import.

function text(parent: Element, selector: string): string | null {
    return parent.querySelector(selector)?.textContent?.trim() ?? null;
}

// step + octave + alter → an ABC note. ABC's C is middle C (C4); lowercase is the
// octave above; commas drop an octave, apostrophes raise one. Accidentals prefix
// the letter (^ sharp, _ flat), so a key signature is never needed.
function abcNote(step: string, octave: number, alter: number): string {
    const accidental = alter > 0 ? "^".repeat(alter) : alter < 0 ? "_".repeat(-alter) : "";
    let letter = step.toUpperCase();
    let octaveMark = "";
    if (octave >= 5) {
        letter = letter.toLowerCase();
        octaveMark = "'".repeat(octave - 5);
    } else if (octave < 4) {
        octaveMark = ",".repeat(4 - octave);
    }
    return `${accidental}${letter}${octaveMark}`;
}

// A note's ABC length, relative to the L:1/4 unit (a quarter note). e.g. a half
// note is "2", an eighth "/2", a dotted quarter "3/2".
function abcLength(quarters: number): string {
    // A missing or zero duration has no length suffix; "0" would be invalid ABC.
    if (quarters <= 0) {
        return "";
    }
    for (const denominator of [1, 2, 4, 8, 16]) {
        const numerator = quarters * denominator;
        if (Math.abs(numerator - Math.round(numerator)) < 1e-6) {
            const whole = Math.round(numerator);
            if (denominator === 1) {
                return whole === 1 ? "" : String(whole);
            }
            return `${whole === 1 ? "" : whole}/${denominator}`;
        }
    }
    return "";
}

// Extend the previous note/chord token with another pitch, turning e.g. "C2"
// into "[CE]2", so chord members merge into one bracketed step.
function mergeChord(previous: string, pitch: string): string {
    const match = previous.match(/^(\[[^\]]*\]|[\^_=]*[A-Ga-g][,']*)(.*)$/);
    if (!match) {
        return previous;
    }
    const [, body, length] = match;
    const inner = body.startsWith("[") ? body.slice(1, -1) : body;
    return `[${inner}${pitch}]${length}`;
}

// Build the ABC tokens for one measure, bucketed by staff (1 = top). A note
// flagged <chord/> merges into the previous note on its staff.
function measureTokens(measure: Element, divisions: number): Map<number, string[]> {
    const byStaff = new Map<number, string[]>();
    for (const note of measure.querySelectorAll("note")) {
        if (note.querySelector("grace")) {
            continue;
        }
        const staff = Number(text(note, "staff")) || 1;
        const length = abcLength((Number(text(note, "duration")) || 0) / divisions);
        const tokens = byStaff.get(staff) ?? [];
        byStaff.set(staff, tokens);

        if (note.querySelector("rest")) {
            tokens.push(`z${length}`);
            continue;
        }
        const pitch = note.querySelector("pitch");
        if (!pitch) {
            continue;
        }
        const noteAbc = abcNote(
            text(pitch, "step") ?? "C",
            Number(text(pitch, "octave")) || 4,
            Number(text(pitch, "alter")) || 0,
        );
        if (note.querySelector("chord") && tokens.length > 0) {
            tokens[tokens.length - 1] = mergeChord(tokens[tokens.length - 1], noteAbc);
        } else {
            tokens.push(`${noteAbc}${length}`);
        }
    }
    return byStaff;
}

export function musicXmlToAbc(xml: string): string {
    const doc = new DOMParser().parseFromString(xml, "application/xml");
    if (doc.querySelector("parsererror")) {
        throw new Error("That file is not valid XML.");
    }
    const score = doc.querySelector("score-partwise");
    const part = score?.querySelector("part");
    if (!part) {
        throw new Error("Unsupported MusicXML — expected a score-partwise part.");
    }

    const measures = [...part.querySelectorAll("measure")];
    const attributes = part.querySelector("measure attributes");
    const divisions = Number(attributes && text(attributes, "divisions")) || 1;
    const time = attributes?.querySelector("time");
    const beats = Number(time && text(time, "beats")) || 4;
    const beatType = Number(time && text(time, "beat-type")) || 4;

    const perMeasure = measures.map((measure) => measureTokens(measure, divisions));
    const staves = [...new Set(perMeasure.flatMap((m) => [...m.keys()]))].sort((a, b) => a - b);
    if (staves.length === 0) {
        throw new Error("No notes found in the MusicXML.");
    }

    const body = (staff: number) =>
        `${perMeasure.map((m) => (m.get(staff) ?? []).join(" ")).join(" | ")} |`;
    const title = (text(doc.documentElement, "work-title") ?? "Imported song").replace(
        /[\n|]/g,
        " ",
    );
    const meter = `M:${beats}/${beatType}`;

    if (staves.length === 1) {
        return `X:1\nT:${title}\n${meter}\nL:1/4\nK:C\n${body(staves[0])}`;
    }
    return `X:1\nT:${title}\n${meter}\nL:1/4\nV:1 clef=treble\nV:2 clef=bass\nV:1\nK:C\n${body(staves[0])}\nV:2\n${body(staves[1])}`;
}
