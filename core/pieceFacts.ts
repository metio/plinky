// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { readScoreMeta } from "./scoreMeta";
import type { XmlCodec } from "./xml";

// What a piece is, in numbers, for the page that shows it and the document the edge writes.
//
// A piece page used to say a title, a composer and a grade, and 3,300 of them said it in
// the same shape — which is a thin page however good the music is, and it matches a search
// for the title and for nothing else. These are the facts the catalogue already knows: how
// long the piece runs, how it is counted, and how fast it goes.
//
// Read from the score rather than carried alongside it, because the page already holds the
// score and the numbers are in it. The catalogue's manifest bakes the same three from the
// same source, so the edge can write them into a document without the notation.

export type PieceFacts = {
    bars: number;
    beatsPerBar: number;
    tempo: number;
};

// How many bars the piece runs to: the measures of its first part, since every part of a
// score spans the same music and counting all of them would multiply by the staves.
export function barsIn(codec: XmlCodec, xml: string): number {
    const doc = codec.parse(xml);
    if (!doc) {
        return 0;
    }
    const part = doc.querySelector("part");
    return part ? part.querySelectorAll("measure").length : 0;
}

export function readPieceFacts(codec: XmlCodec, xml: string): PieceFacts {
    const meta = readScoreMeta(codec, xml);
    return { bars: barsIn(codec, xml), beatsPerBar: meta.beatsPerBar, tempo: meta.tempo };
}

// Whether there is anything worth saying. A score the codec could not read gives zero
// bars, and "0 bars" on a page is worse than a page that does not mention its length.
export function hasFacts(facts: PieceFacts): boolean {
    return facts.bars > 0 && facts.beatsPerBar > 0 && facts.tempo > 0;
}
