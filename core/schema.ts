// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Which shape the values on a device are written in.
//
// Every push deploys, and a build applies itself at the next route change or when a
// backgrounded tab comes back. So two builds can be running at once: a tab left open on
// yesterday's code beside one on today's. That is fine while the shapes agree and
// dangerous the moment they do not — every parser here reads an unknown field as its
// default and the next save writes that default back, so an older build reading a newer
// shape does not fail, it quietly normalises the player's progress and overwrites it.
//
// The number below is the contract between a build and the values it wrote. A device
// stamped with a number this build does not know is holding something it cannot safely
// write to, and the only correct move is to stop writing and say so.

// Bump this when a stored shape changes in a way an older build would misread — a
// renamed or repurposed field, a changed unit, a narrowed enum. Adding a field an older
// build ignores and leaves alone does not need it.
export const SCHEMA_VERSION = 1;

// Where the device stands relative to the build that is running.
export type SchemaStanding =
    // Nothing stamped: a first visit, or a device written before stamping existed. Its
    // values are this shape by definition, since no other shape has ever shipped.
    | "fresh"
    | "current"
    // Written by an older build. The values need bringing forward before they are
    // trusted; there is nothing to bring forward yet, since this is the first version.
    | "older"
    // Written by a newer build than this one. Reading is fine — the player can still see
    // and export everything — but writing would overwrite a shape this build cannot
    // represent.
    | "newer";

export function schemaStanding(stored: string | null, known: number): SchemaStanding {
    if (stored === null || stored.trim() === "") {
        return "fresh";
    }
    const found = Number(stored);
    // A stamp that is not a number at all is damage rather than a version. Treated as
    // fresh: refusing every write over a stray value would lock the player out of their
    // own device, and the values themselves are still whatever they always were.
    if (!Number.isFinite(found) || !Number.isInteger(found) || found < 1) {
        return "fresh";
    }
    if (found > known) {
        return "newer";
    }
    return found === known ? "current" : "older";
}
