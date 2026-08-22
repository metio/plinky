// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Whether two titles name the same work.
//
// The catalogue is harvested from a corpus where one piece is uploaded many times under
// whatever the transcriber typed, so collapsing it to one row per work depends entirely on
// this. A key of lowercase-and-trim is not enough, and the catalogue proves it: it shipped
// three copies of Für Elise, as
//
//     "Für Elise"          "Fur Elise"          "Für Elise WoO 59"
//
// — three different keys, because an umlaut and a catalogue number each defeat it alone. A
// reader who finds three of one piece in a library reasonably concludes the library is
// broken.
//
// The catalogue number is the subtle half, and it cannot simply be dropped. It is optional in
// a title, so "Für Elise" and "Für Elise WoO 59" have to match — but it is also what tells
// two works apart when they share a name, and "Nocturnes Op.27" and "Nocturnes Op.9" are
// different sets. Discarding it merges those; keeping it separates Für Elise from itself.
// So it is neither: the number is held apart from the name, absent matches anything, and two
// different numbers never match.

export type WorkTitle = {
    // The name with its accents folded and its punctuation flattened — a transcriber types
    // with whatever keyboard they have, and "Fur" and "Für" are one piece.
    name: string;
    // The catalogue mark, normalised ("woo 59", "op 27"), or null where the title has none.
    catalogue: string | null;
};

// A catalogue mark: a known prefix, then a number that may be arabic (BWV 1068), roman
// (Hob. XVI:34), or both (Op. 27 No. 2 — only the opus is taken, the movement being part of
// the name).
const CATALOGUE = /\b(woo|opus|op|bwv|kv|hob|hwv|rv|wwv|anh|k|d|s|b|l|cd)\b\.?\s*([ivxlc]+[:.]?\s*)?(\d+)\s*([a-z]\b)?/i;

export function workTitle(title: string): WorkTitle {
    const folded = (title || "")
        .normalize("NFKD")
        // Combining marks, left behind by the decomposition above: ü becomes u + ¨.
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase();
    const found = CATALOGUE.exec(folded);
    const catalogue = found
        ? `${found[1]} ${(found[2] ?? "").replace(/[^a-z0-9]/g, "")}${found[3]}${found[4] ?? ""}`.replace(
              /\s+/g,
              " ",
          )
        : null;
    const name = (found ? folded.replace(CATALOGUE, " ") : folded)
        .replace(/[^a-z0-9]+/g, " ")
        .trim();
    return { name, catalogue };
}

// Two titles are the same work when they name the same thing and nothing contradicts it: a
// title with no catalogue mark agrees with one that has it, and two different marks never do.
export function sameWork(one: WorkTitle, other: WorkTitle): boolean {
    if (one.name !== other.name || one.name === "") {
        return false;
    }
    return one.catalogue === null || other.catalogue === null || one.catalogue === other.catalogue;
}
