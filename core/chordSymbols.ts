// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { stavesPerPart } from "./accompaniment";
import { type ChordSpan, readHarmony } from "./harmony";
import { readTimeline } from "./musicxmlTimeline";
import { spellMidi } from "./notes";
import { partsOf } from "./parts";
import type { ChordQuality } from "./theory";
import type { XmlCodec } from "./xml";

// Chord symbols written into a score that has none.
//
// The engraver already draws a chord symbol wherever a file writes `<harmony>` — a lead
// sheet's C, Am, G7 above the staff — and eighty-seven of three thousand catalogue scores
// do. This writes the same element into the rest, from what core/harmony reads off the
// notes, so a reader sees a bar of nine notes as "C, then G7" and carries the shape to
// the next piece in the key. Only where the reading is sure: a chord that fit less than
// `least` of what sounded is left unlabelled rather than named wrongly, because a label
// under a suspension teaches the wrong thing and an empty beat teaches nothing.
//
// Written before the first note of the right hand at each chord's onset, which is where
// a lead sheet puts it and where the engraver expects it. A score that carries its own
// symbols keeps them: the editor's word beats the reading.

export const SURE_ENOUGH = 0.6;

// The MusicXML `<kind>` for each quality the reader can name. Anything else is written
// as "other" with the quality's own text, which the engraver prints as it stands.
const KIND: Partial<Record<ChordQuality, string>> = {
    major: "major",
    minor: "minor",
    diminished: "diminished",
    augmented: "augmented",
    "dominant-seventh": "dominant",
    "major-seventh": "major-seventh",
    "minor-seventh": "minor-seventh",
    "half-diminished-seventh": "half-diminished",
    "diminished-seventh": "diminished-seventh",
    "minor-major-seventh": "major-minor",
    "suspended-second": "suspended-second",
    "suspended-fourth": "suspended-fourth",
};

export function withChordSymbols(codec: XmlCodec, xml: string, least = SURE_ENOUGH): string {
    const doc = codec.parse(xml);
    if (!doc || doc.getElementsByTagName("harmony").length > 0) {
        return xml;
    }
    const timeline = readTimeline(doc);
    const spans = readHarmony(timeline).filter((span) => span.confidence >= least);
    if (spans.length === 0) {
        return xml;
    }
    const { right } = partsOf(stavesPerPart(doc));
    // The right hand's notes in printed order: the symbol goes before the first of them
    // at or after the chord's onset, so a chord that arrives on a left-hand beat lands on
    // the next right-hand note — which is where the eye is.
    const hosts = timeline.notes.filter(
        (note) => note.staffId === right && !note.grace && !note.chord,
    );
    let at = 0;
    for (const span of spans) {
        while (at < hosts.length && (hosts[at]?.whole ?? 0) < span.from - EPSILON) {
            at += 1;
        }
        const host = hosts[at];
        if (!host || host.whole >= span.to - EPSILON) {
            continue;
        }
        host.element.parentNode?.insertBefore(harmonyElement(doc, span), host.element);
        at += 1;
    }
    return codec.serialize(doc);
}

const EPSILON = 1e-6;

// Spelled the way the key reads: flats in a flat key, sharps otherwise — the same rule
// that spells a chromatic run — so an E♭ major chord in E♭ is E♭ and never D♯.
function harmonyElement(doc: Document, span: ChordSpan): Element {
    const flats = spellsFlat(span);
    const harmony = doc.createElement("harmony");
    const root = doc.createElement("root");
    root.appendChild(pitchElement(doc, "root-step", "root-alter", span.root, flats));
    harmony.appendChild(root);
    const kind = doc.createElement("kind");
    const known = KIND[span.quality];
    kind.textContent = known ?? "other";
    if (known === undefined) {
        kind.setAttribute("text", span.quality);
    }
    harmony.appendChild(kind);
    if (span.inversion > 0) {
        const bass = doc.createElement("bass");
        bass.appendChild(pitchElement(doc, "bass-step", "bass-alter", span.bass, flats));
        harmony.appendChild(bass);
    }
    return harmony;
}

function pitchElement(
    doc: Document,
    stepTag: string,
    alterTag: string,
    pitchClass: number,
    flats: boolean,
): DocumentFragment {
    const { step, alter } = spellMidi(60 + pitchClass, flats);
    const fragment = doc.createDocumentFragment();
    const stepElement = doc.createElement(stepTag);
    stepElement.textContent = step;
    fragment.appendChild(stepElement);
    if (alter !== 0) {
        const alterElement = doc.createElement(alterTag);
        alterElement.textContent = String(alter);
        fragment.appendChild(alterElement);
    }
    return fragment;
}

// The flat keys, by their major tonic: F and the five flat keys round the circle. A minor
// key spells like its relative major.
const FLAT_TONICS = new Set([5, 10, 3, 8, 1, 6]);

export function spellsFlat(span: { key: ChordSpan["key"] }): boolean {
    const major = span.key.mode === "major" ? span.key.tonic : (span.key.tonic + 3) % 12;
    return FLAT_TONICS.has(major);
}
