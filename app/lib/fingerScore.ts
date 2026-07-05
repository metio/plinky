// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { fingerPositions } from "../../core/fingering";
import type { HandSpan } from "../../core/prefs";
import { type FingerMap, fingerKey } from "../stores/fingeringStore";
import { scoreToBars } from "../../core/scoreToBars";
import type { XmlCodec } from "../../core/xml";

// Suggested fingering belongs on the staff, the way printed music carries it —
// tied to the note you read, not mapped onto a key. This annotates a score's
// MusicXML with <technical><fingering> per note, computed per hand from the
// fingering cost model and personalised to the player's reach, for OSMD to print.

const STEP_SEMITONES: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

function midiOf(note: Element): number | null {
    const pitch = note.querySelector("pitch");
    if (!pitch) {
        return null; // a rest or unpitched note has no finger
    }
    const step = pitch.querySelector("step")?.textContent?.trim() ?? "";
    const semitone = STEP_SEMITONES[step];
    if (semitone === undefined) {
        return null;
    }
    const octave = Number(pitch.querySelector("octave")?.textContent ?? "4");
    const alter = Number(pitch.querySelector("alter")?.textContent ?? "0");
    return (octave + 1) * 12 + semitone + alter;
}

type Bucket = { pitches: number[][]; notes: Element[][] };

function inject(doc: Document, note: Element, finger: number): void {
    const notations = doc.createElement("notations");
    const technical = doc.createElement("technical");
    const fingering = doc.createElement("fingering");
    fingering.textContent = String(finger);
    technical.appendChild(fingering);
    notations.appendChild(technical);
    note.appendChild(notations);
}

// The player's saved fingers for one staff, flattened to match the bucket's positions
// (scoreToBars groups notes by staff and chord in document order, the same way the
// bucket below does, so the indices line up). null where they haven't chosen one.
function savedForStaff(
    codec: XmlCodec,
    xml: string,
    saved: FingerMap,
    hand: "left" | "right",
): (number | null)[][] {
    const flat: (number | null)[][] = [];
    scoreToBars(codec, xml, hand === "right" ? 1 : 2).forEach((bar, b) => {
        bar.forEach((pos, p) => {
            flat.push(pos.map((_, n) => saved[fingerKey(hand, b, p, n)] ?? null));
        });
    });
    return flat;
}

// Annotates the score's MusicXML with a finger per note for OSMD to print. With a
// `saved` map, the player's own choices win where they've made them and the suggested
// fingering fills the rest — so the staff can show "your fingering" for a piece.
export function annotateFingerings(
    codec: XmlCodec,
    xml: string,
    span: HandSpan,
    saved?: FingerMap,
): string {
    const doc = codec.parse(xml);
    if (!doc) {
        return xml;
    }
    // Group each staff's notes into positions (a chord shares one), staff 1 the
    // right hand and staff 2 the left, keeping a parallel handle on the elements so
    // each note's finger can be written back onto it.
    const staves = new Map<string, Bucket>();
    for (const note of doc.querySelectorAll("note")) {
        const midi = midiOf(note);
        if (midi === null) {
            continue;
        }
        const staff = note.querySelector("staff")?.textContent?.trim() === "2" ? "2" : "1";
        let bucket = staves.get(staff);
        if (!bucket) {
            bucket = { pitches: [], notes: [] };
            staves.set(staff, bucket);
        }
        const last = bucket.pitches.length - 1;
        if (note.querySelector("chord") && last >= 0) {
            bucket.pitches[last]?.push(midi);
            bucket.notes[last]?.push(note);
        } else {
            bucket.pitches.push([midi]);
            bucket.notes.push([note]);
        }
    }

    for (const [staff, bucket] of staves) {
        const hand = staff === "2" ? "left" : "right";
        const fingers = fingerPositions(bucket.pitches, hand, span[hand] ?? undefined);
        const mine = saved ? savedForStaff(codec, xml, saved, hand) : null;
        bucket.notes.forEach((position, p) => {
            position.forEach((note, i) => {
                const finger = mine?.[p]?.[i] ?? fingers[p]?.[i];
                if (finger) {
                    inject(doc, note, finger);
                }
            });
        });
    }
    return codec.serialize(doc);
}
