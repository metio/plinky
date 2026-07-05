// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// The one score shape every layer speaks: MusicXML pieces rendered and
// practised on OSMD, whether bundled with the app, imported by the user,
// generated from an exercise config, or fetched from the song catalogue.
// Pure data, so stores and dev tooling can depend on it without touching
// the storage-backed catalogue module.
export type Score = {
    id: string;
    title: string;
    composer: string;
    description: string;
    xml: string;
    tempo: number; // beats per minute for the count-in and playback
    beatsPerBar: number;
    license?: string;
    // Provenance id (e.g. "pdmx") resolved to a credited source link; absent for
    // bundled demos and generated exercises, which are our own.
    source?: string;
    bundled: boolean; // true for the shipped scores, which cannot be removed
};
