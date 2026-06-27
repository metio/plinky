// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// Turns a piece's MusicXML into per-bar chord positions for one hand, so a passage
// can be fingered (or reproduced by ear). Each bar is a list of positions in play
// order; each position is the MIDI pitches sounding together — a single note, or a
// chord. Reads one hand's staff (treble for the right, bass for the left), the way a
// pianist reads each hand separately.

const STEP_SEMITONES: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

export type Bar = number[][];
// 1 = treble (right hand), 2 = bass (left hand) — the conventional grand-staff split.
export type Staff = 1 | 2;

export function staffFor(hand: "left" | "right"): Staff {
    return hand === "right" ? 1 : 2;
}

function midiOf(note: Element): number | null {
    const pitch = note.getElementsByTagName("pitch")[0];
    if (!pitch) {
        return null;
    }
    const step = pitch.getElementsByTagName("step")[0]?.textContent ?? "";
    const octaveText = pitch.getElementsByTagName("octave")[0]?.textContent ?? "";
    if (!(step in STEP_SEMITONES) || octaveText === "") {
        return null;
    }
    const alter = Number(pitch.getElementsByTagName("alter")[0]?.textContent ?? "0");
    return (Number(octaveText) + 1) * 12 + STEP_SEMITONES[step]! + alter;
}

// Parse the first part's measures into bars of positions for the given staff. A note
// marked <chord/> joins the position before it; rests and the other staff are skipped.
// Returns an empty array for unreadable XML, so callers can fall back gracefully.
export function scoreToBars(xml: string, staff: Staff): Bar[] {
    let doc: Document;
    try {
        doc = new DOMParser().parseFromString(xml, "application/xml");
    } catch {
        return [];
    }
    if (doc.getElementsByTagName("parsererror").length > 0) {
        return [];
    }
    const part = doc.getElementsByTagName("part")[0];
    if (!part) {
        return [];
    }
    const bars: Bar[] = [];
    for (const measure of Array.from(part.getElementsByTagName("measure"))) {
        const positions: number[][] = [];
        for (const note of Array.from(measure.getElementsByTagName("note"))) {
            if (note.getElementsByTagName("rest").length > 0) {
                continue;
            }
            const noteStaff = Number(note.getElementsByTagName("staff")[0]?.textContent ?? "1");
            if (noteStaff !== staff) {
                continue;
            }
            const midi = midiOf(note);
            if (midi === null) {
                continue;
            }
            if (note.getElementsByTagName("chord").length > 0 && positions.length > 0) {
                positions[positions.length - 1]!.push(midi);
            } else {
                positions.push([midi]);
            }
        }
        bars.push(positions);
    }
    return bars;
}

// The positions of a window of bars, flattened in play order — what the fingering or
// ear drill works on. Clamps the range to the available bars.
export function windowPositions(bars: Bar[], start: number, size: number): number[][] {
    return bars.slice(Math.max(0, start), Math.max(0, start) + size).flat();
}
