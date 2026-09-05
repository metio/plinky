// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { fingerPositions } from "../../core/fingering";
import type { HandSpan } from "../../core/prefs";
import { staffFor, timedBarsOf } from "../../core/scoreToBars";
import type { XmlCodec } from "../../core/xml";
import { type FingerMap, fingerKey } from "../stores/fingeringStore";

// Suggested fingering belongs on the staff, the way printed music carries it —
// tied to the note you read, not mapped onto a key. This annotates a score's
// MusicXML with <technical><fingering> per note, computed per hand from the
// fingering cost model and personalised to the player's reach, for OSMD to print.

function inject(doc: Document, note: Element, finger: number): void {
    const notations = doc.createElement("notations");
    const technical = doc.createElement("technical");
    const fingering = doc.createElement("fingering");
    fingering.textContent = String(finger);
    technical.appendChild(fingering);
    notations.appendChild(technical);
    note.appendChild(notations);
}

const HANDS = ["right", "left"] as const;

// Annotates the score's MusicXML with a finger per note for OSMD to print. With a
// `saved` map, the player's own choices win where they've made them and the suggested
// fingering fills the rest — so the staff can show "your fingering" for a piece.
//
// Each hand is read off the piano part by the same walk the fingering strip reads its
// bars with, so the number printed on a note, the strip's suggestion for it and the
// player's saved choice all name one position. A singer's line above the piano is not
// fingered: it is not the player's, and letting it seed the right hand's search
// priced the piano's first move as a leap from the last sung note.
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
    for (const hand of HANDS) {
        const { bars, gaps, notes } = timedBarsOf(doc, staffFor(hand));
        // Fingered against the clock as well as the shape, under the prices the piece
        // actually charges: a leap the hand has a whole beat to make should not force
        // the fingering a leap between two sixteenths would.
        const fingers = fingerPositions(bars.flat(), hand, span[hand] ?? undefined, gaps.flat());
        let flat = 0;
        bars.forEach((bar, b) => {
            bar.forEach((_, p) => {
                notes[b]?.[p]?.forEach((note, n) => {
                    const finger = saved?.[fingerKey(hand, b, p, n)] ?? fingers[flat]?.[n];
                    if (finger) {
                        inject(doc, note, finger);
                    }
                });
                flat += 1;
            });
        });
    }
    return codec.serialize(doc);
}
