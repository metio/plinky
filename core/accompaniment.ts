// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { partsOf } from "./parts";
import type { XmlCodec } from "./xml";

// An art song's MusicXML carries the singer as well as the piano, and engraving all of
// it hands a piano learner two systems where one is theirs. Dropping the other parts
// before the sheet is loaded — rather than hiding them after — means the cursor, the
// matcher and every staff index downstream see a plain grand staff, exactly as they do
// for a piece written for piano alone.
//
// Bringing the accompaniment back is then the same score with nothing removed, where the
// hand mapping resolves the piano's staves from the part layout and the rest is engraved
// but never demanded of the player.

// How many staves each <part> is written on, in score order. A part that states no
// <staves> is on one, which is what the format means by leaving it out.
export function stavesPerPart(doc: Document): number[] {
    return Array.from(doc.querySelectorAll("score-partwise > part, score-timewise > part")).map(
        (part) => {
            const stated = part.querySelector("attributes > staves")?.textContent?.trim();
            const count = stated === undefined ? Number.NaN : Number.parseInt(stated, 10);
            return Number.isInteger(count) && count > 0 ? count : 1;
        },
    );
}

function partElements(doc: Document): Element[] {
    return Array.from(doc.querySelectorAll("score-partwise > part, score-timewise > part"));
}

// The played instrument's <part>: the one partsOf names the staves of, found by walking
// the same running offsets it does. Null when the score has no part at all. Every reader
// of the piano's notes — the fingering, the strip's bars — goes through this, so that on
// an art song they all read the piano and none of them the singer written above it.
export function pianoPart(doc: Document): Element | null {
    const parts = partElements(doc);
    const counts = stavesPerPart(doc);
    const { right } = partsOf(counts);
    let running = 0;
    for (const [index, count] of counts.entries()) {
        if (right >= running && right < running + count) {
            return parts[index] ?? null;
        }
        running += count;
    }
    return null;
}

// Removes every part but the played instrument's, along with its entry in the part list
// so the score's header no longer names a musician who is not there. Returns the input
// unchanged when the score has one part, when nothing is well-formed, or when the layout
// resolves to no single part — a no-op stays cheap and malformed input is a normal
// condition rather than a throw.
export function stripAccompaniment(codec: XmlCodec, xml: string): string {
    const doc = codec.parse(xml);
    if (!doc) {
        return xml;
    }
    const parts = partElements(doc);
    if (parts.length < 2) {
        return xml;
    }
    const kept = pianoPart(doc);
    if (!kept) {
        return xml;
    }
    const keptId = kept.getAttribute("id");
    for (const part of parts) {
        if (part !== kept) {
            part.remove();
        }
    }
    for (const listed of Array.from(doc.querySelectorAll("part-list > score-part"))) {
        if (listed.getAttribute("id") !== keptId) {
            listed.remove();
        }
    }
    // A part group bracketing parts that are gone would brace a single staff system.
    for (const group of Array.from(doc.querySelectorAll("part-list > part-group"))) {
        group.remove();
    }
    return codec.serialize(doc);
}
