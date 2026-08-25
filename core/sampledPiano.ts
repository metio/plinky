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

// What a recording that is not a struck note is a recording OF.
//
// A piano makes two sounds a struck string does not. `knock` is the key-off noise — the
// damper landing and the mechanism returning — which is a large part of why a real piano
// sounds like an object somebody is operating rather than a tone generator. `resonance` is
// the sympathetic ring of the other strings, which is what the sustain pedal actually
// sounds like beyond "notes last longer".
export type ExtraKind = "knock" | "resonance";
export const EXTRA_KINDS: ExtraKind[] = ["knock", "resonance"];

export type SampleRegion = {
    // The recording, by name within the pack.
    file: string;
    // Absent on a struck note; present on everything in `releases`, saying which of the two
    // sounds this is. Absent is also how an older pack reads, and an extra whose kind cannot
    // be told apart from another's is one nothing should play — see extrasFor.
    kind?: ExtraKind;
    // How long the recording rings, in seconds, where the pack measured it. Advisory: the
    // buffer's own duration is the truth, and this is only carried so a caller can budget
    // without decoding.
    decay?: number;
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
// The extra recordings of one kind that answer this key at this force. Filtered before the
// nearest-match walk rather than after, so a knock can never be answered by a resonance
// that happened to sit closer — they are different sounds, and the closest recording of the
// wrong one is worse than none.
export function extrasFor(
    regions: readonly SampleRegion[],
    pitch: number,
    velocity: number,
    kind: ExtraKind,
): SampleRegion | null {
    return regionFor(
        regions.filter((region) => region.kind === kind),
        pitch,
        velocity,
    );
}

export function regionsNeeded(
    regions: readonly SampleRegion[],
    notes: readonly { pitch: number; velocity: number }[],
    kind?: ExtraKind,
): SampleRegion[] {
    const wanted = new Map<string, SampleRegion>();
    for (const note of notes) {
        const region = kind
            ? extrasFor(regions, note.pitch, note.velocity, kind)
            : regionFor(regions, note.pitch, note.velocity);
        if (region) {
            wanted.set(region.file, region);
        }
    }
    return [...wanted.values()];
}

// What a pack is owed on screen. The library is CC-BY: it may be used for anything,
// including something somebody pays for, as long as it is credited — so the credit is not
// optional and not a footnote.
// Every distinct recording the pack holds — struck notes and the two extras alike, by
// file, because a device holds files and two regions can name the same one.
//
// This is the denominator the settings panel counts against: "142 of 611 recordings", which
// is the only form in which the figure means anything. On its own, "142 recordings" tells a
// player nothing about whether the instrument is mostly here or barely started.
export function packFiles(manifest: SampleManifest): string[] {
    const files = new Set<string>();
    for (const region of [...manifest.notes, ...manifest.releases]) {
        files.add(region.file);
    }
    return [...files];
}

export function sampleCredit(manifest: SampleManifest): string {
    return `${manifest.instrument} by ${manifest.author} · ${manifest.license}`;
}

// Whether the recorded piano is on, from whatever the device has stored for it.
//
// On unless the player has turned it off — a recorded concert grand is simply what this
// instrument sounds like, and while it was off by default almost nobody ever heard it. A
// setting nobody finds is a feature nobody has.
//
// So the stored value is read for "off" rather than for "on": an absent key — a new device,
// a cleared store, a player who has never touched the setting — means on, and only an
// explicit "0" means off. Read the other way round, every new device would be silent again,
// which is the state this is trying to leave.
//
// Nothing is downloaded up front by saying yes here. The recordings arrive a piece at a
// time, so a player who never opens one fetches nothing at all.
export function samplesEnabled(stored: string | null): boolean {
    return stored !== "0";
}
