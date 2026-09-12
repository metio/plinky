// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { pianoParts, stavesOf } from "./accompaniment";

// Where a mark written in one part lands on the page the engraver draws.
//
// A mark is read from the file, where it is written in a part, on a staff counted from 1
// within that part. It is laid over notes that come off the engraver, which counts its
// staves from 0 across the parts it draws. The two numberings agree only when every part is
// drawn: on an art song with the singer taken off the page, the piano's right hand is the
// file's second staff and the engraver's first. Every mark that belongs to a staff — an
// arch, a tremolo, a glissando — goes through this one mapping, so none of them can be laid
// over another part's notes.

export type MarkScope = {
    // The engraver's 0-based staff for a staff named the way the file names it — the id of
    // its part and its 1-based number within that part — or null for a part the page does
    // not draw.
    engraved: (part: string, staff: number) => number | null;
};

// `accompaniment` says whether the page draws the parts besides the played instrument's,
// as it does when the player asks for them. Without them the page is the piano's parts
// alone, chosen the way stripAccompaniment chooses them, and numbered from 0.
export function markScope(doc: Document, accompaniment: boolean): MarkScope {
    const every = Array.from(doc.querySelectorAll("score-partwise > part, score-timewise > part"));
    const piano = pianoParts(doc);
    // stripAccompaniment leaves a score it cannot narrow to the piano as it is.
    const drawn = accompaniment || piano.length === 0 ? every : piano;
    const offsets = new Map<string, number>();
    let running = 0;
    for (const part of drawn) {
        const id = part.getAttribute("id") ?? "";
        if (!offsets.has(id)) {
            offsets.set(id, running);
        }
        running += stavesOf(part);
    }
    return {
        engraved: (part, staff) => {
            const offset = offsets.get(part);
            return offset === undefined ? null : offset + Math.max(1, staff) - 1;
        },
    };
}
