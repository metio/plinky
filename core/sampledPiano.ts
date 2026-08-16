// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Which recording of a real piano answers a given key struck at a given force.
//
// A sampled instrument is a table lookup and a pitch shift, and both have to be exactly
// what the library's own mapping says: the recordings are made every minor third and split
// into sixteen layers by how hard the key was hit, and a note fetched from the wrong layer
// is the difference between a piano and a keyboard. The table arrives as data — the pack's
// manifest, built from the library's SFZ — so nothing here has an opinion about the
// instrument beyond how to read it.
//
// Pure: no audio, no fetching, no clock. What sounds a note is app/adapters; what decides
// which note to sound is here, where it can be tested against every key and every velocity
// at once.

export type SampleRegion = {
    // The recording, by name within the pack.
    file: string;
    // The key it was actually played at, which is what a shift is measured from.
    keyCentre: number;
    lowKey: number;
    highKey: number;
    lowVelocity: number;
    highVelocity: number;
};

export type SampleManifest = {
    instrument: string;
    author: string;
    license: string;
    source: string;
    version: string;
    notes: SampleRegion[];
    releases: SampleRegion[];
};

// The recording that answers this key at this force, or null when the manifest covers
// neither — a caller sounds its synthesised voice instead, which is what happens for every
// note until the recordings arrive anyway.
export function regionFor(
    regions: readonly SampleRegion[],
    pitch: number,
    velocity: number,
): SampleRegion | null {
    let nearest: SampleRegion | null = null;
    let nearestCost = Number.POSITIVE_INFINITY;
    for (const region of regions) {
        if (
            pitch >= region.lowKey &&
            pitch <= region.highKey &&
            velocity >= region.lowVelocity &&
            velocity <= region.highVelocity
        ) {
            return region;
        }
        // How wrong this recording would be, in case nothing covers the note: a key away
        // matters more than a velocity layer away, because the ear hears a bad pitch shift
        // long before it hears the wrong dynamic.
        const cost =
            Math.abs(region.keyCentre - pitch) * 4 +
            Math.abs((region.lowVelocity + region.highVelocity) / 2 - velocity) / 8;
        if (cost < nearestCost) {
            nearestCost = cost;
            nearest = region;
        }
    }
    return nearest;
}

// How fast to play a recording to make it sound at this pitch. The grid is sampled every
// minor third, so nothing is shifted more than a tone — the range where a piano still
// sounds like the piano it was recorded from.
export function playbackRateFor(pitch: number, keyCentre: number): number {
    return 2 ** ((pitch - keyCentre) / 12);
}

// Every recording a run of notes will ask for. A score is the whole list of notes before
// one of them sounds, so this is what the app fetches when a piece opens rather than
// discovering it a note at a time with the player waiting.
export function regionsNeeded(
    regions: readonly SampleRegion[],
    notes: readonly { pitch: number; velocity: number }[],
): SampleRegion[] {
    const wanted = new Map<string, SampleRegion>();
    for (const note of notes) {
        const region = regionFor(regions, note.pitch, note.velocity);
        if (region) {
            wanted.set(region.file, region);
        }
    }
    return [...wanted.values()];
}

// What a pack is owed on screen. The library is CC-BY: it may be used for anything,
// including something somebody pays for, as long as it is credited — so the credit is not
// optional and not a footnote.
export function sampleCredit(manifest: SampleManifest): string {
    return `${manifest.instrument} by ${manifest.author} · ${manifest.license}`;
}
