// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A thinner reading of a piece, for playing it before you can play it.
//
// This is what a teacher does when somebody wants a piece they cannot manage yet: take out
// the inner notes, or the left hand, so the tune is playable today and the real thing is
// something to work toward. It is a way in, not a way around — a run against a reduction
// never clears a grade, counts for the daily, or earns a star, because the piece being
// played is not the piece that was written.
//
// THE RULE THAT MAKES IT SAFE: notes are only ever REMOVED. Nothing is moved, nothing is
// re-timed, and nothing is invented. Every note that survives keeps its own pitch and its
// own place in the bar, so the melody and the rhythm are what the composer wrote — which is
// the difference between a reduction and an arrangement, and the reason this can be applied
// to any score in the catalogue without a human checking the result. Where taking a note
// away would leave a bar that no longer adds up, a rest of exactly that length stands in
// its place: the notation still has to account for the time, even though nothing sounds.
//
// What that buys, and what it does not: a reduction is always playable and always faithful,
// and it is never as good as an arrangement a person would write. Nothing here redistributes
// a line between the hands or folds a broken chord into a block. It thins.

import { midiOf } from "./notes";
import type { Reduction } from "./reduction";
import type { XmlCodec } from "./xml";

type Sounded = {
    note: Element;
    midi: number;
    // Chord members carry no duration of their own: they sound with the note they follow,
    // so removing one cannot change when anything else happens.
    member: boolean;
};

const pitchOf = (note: Element): number | null => {
    const pitch = note.querySelector("pitch");
    if (!pitch) {
        return null;
    }
    const step = pitch.querySelector("step")?.textContent?.trim() ?? "";
    if (step === "") {
        return null;
    }
    return midiOf(
        step,
        Number(pitch.querySelector("octave")?.textContent ?? "4"),
        Number(pitch.querySelector("alter")?.textContent ?? "0"),
    );
};

const staffOf = (note: Element): number =>
    Number(note.querySelector("staff")?.textContent?.trim() ?? "1");

// A chord, kept as its head and everything sounding with it. The head is named rather than
// indexed because it is the only note carrying the group's duration, and every rule below
// turns on that.
type Chord = { head: Sounded; all: Sounded[] };

// Notes that sound together, in the order the file writes them: a chord head followed by its
// members. MusicXML puts them adjacent by definition — a <chord/> note sounds with the note
// before it — so a group is a run, not a search.
function chords(measure: Element): Chord[] {
    const groups: Chord[] = [];
    let group: Chord | null = null;
    for (const note of Array.from(measure.children)) {
        if (note.tagName !== "note") {
            continue;
        }
        // A grace note steals its time from the note it decorates and has no duration of its
        // own. Left alone: it is an ornament, and removing ornaments is a different question
        // from thinning a texture.
        if (note.querySelector("grace")) {
            continue;
        }
        const midi = pitchOf(note);
        if (midi === null) {
            // A rest ends whatever came before it and belongs to no chord.
            group = null;
            continue;
        }
        const member = note.querySelector("chord") !== null;
        if (member && group !== null) {
            group.all.push({ note, midi, member });
        } else {
            const head: Sounded = { note, midi, member: false };
            group = { head, all: [head] };
            groups.push(group);
        }
    }
    return groups;
}

// Which of a chord's notes survive, by level and by which hand is playing it.
//
// The outer notes are the ones that carry the music: the top note is the tune the ear
// follows and the bottom is the harmony's foundation. What comes out of the middle is the
// filling — the part a player adds once the frame is under their fingers.
function keepers(chord: Chord, level: Reduction, upper: boolean): Set<Element> {
    let lowest = chord.head;
    let highest = chord.head;
    for (const sounded of chord.all) {
        if (sounded.midi < lowest.midi) {
            lowest = sounded;
        }
        if (sounded.midi > highest.midi) {
            highest = sounded;
        }
    }
    if (level === "melody") {
        return upper ? new Set([highest.note]) : new Set();
    }
    if (level === "outlined") {
        return new Set([(upper ? highest : lowest).note]);
    }
    return new Set([lowest.note, highest.note]);
}

// Takes a note out of the bar without disturbing anything that is left.
//
// Three cases, and getting them wrong is how a reduction stops being one. A chord member
// occupies no time, so it simply goes. A chord head does carry the group's duration, so
// when it goes and something of the chord remains, the first survivor is promoted in its
// place — it already has the same duration, that is what makes it part of the chord. And a
// note whose whole group is leaving is replaced by a rest of its own length, because the bar
// still has to account for the time even though nothing sounds in it.
function drop(chord: Chord, keep: Set<Element>): void {
    const going = chord.all.filter((sounded) => !keep.has(sounded.note));
    if (going.length === 0) {
        return;
    }
    const survivors = chord.all.filter((sounded) => keep.has(sounded.note));
    const promoted = survivors[0];

    if (promoted !== undefined) {
        for (const sounded of going) {
            sounded.note.remove();
        }
        // The survivor standing where the head stood must stop claiming to follow one.
        promoted.note.querySelector("chord")?.remove();
        return;
    }

    // Nothing of this chord survives: the head becomes a rest of the same length, and the
    // members — which never had a length of their own — go.
    for (const sounded of chord.all) {
        if (sounded !== chord.head) {
            sounded.note.remove();
        }
    }
    silence(chord.head.note);
}

// Turns a note into a rest of exactly its own length, in place.
//
// Everything that described a sound is removed — the pitch, the tie it was part of, the beam
// it was drawn in, how it was to be played, whose finger was on it. What stays is the
// duration, the voice and the staff: the three things the bar is counted in.
function silence(note: Element): void {
    for (const child of Array.from(note.children)) {
        if (!["duration", "voice", "staff", "type"].includes(child.tagName)) {
            child.remove();
        }
    }
    const rest = note.ownerDocument.createElement("rest");
    note.insertBefore(rest, note.firstChild);
}

// A reduction of the score, or the score unchanged when there is nothing to take out.
export function simplify(codec: XmlCodec, xml: string, level: Reduction): string {
    const doc = codec.parse(xml);
    if (!doc) {
        return xml;
    }
    const measures = Array.from(doc.querySelectorAll("part > measure"));
    if (measures.length === 0) {
        return xml;
    }
    // Which staff counts as the upper hand, per part. A grand staff writes the tune on staff
    // 1; a part with one staff is that hand by itself, whatever it is playing.
    let changed = false;
    for (const measure of measures) {
        for (const chord of chords(measure)) {
            const upper = staffOf(chord.head.note) <= 1;
            const keep = keepers(chord, level, upper);
            if (keep.size < chord.all.length) {
                changed = true;
            }
            drop(chord, keep);
        }
    }
    return changed ? codec.serialize(doc) : xml;
}
