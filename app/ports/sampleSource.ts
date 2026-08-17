// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { SampleManifest, SampleRegion } from "../../core/sampledPiano";

// A note a piece will play: enough to choose its recording, and nothing else.
export type PlayedNote = { pitch: number; velocity: number };

// Where recordings of a real piano come from.
//
// The seam exists because of one rule: **a note-on never waits.** A key pressed now sounds
// now, with whatever the instrument has to hand — so `bufferFor` is synchronous and
// answers null for anything not yet decoded, and the engine plays its own voice instead.
// Everything that can take time (fetching, decoding) happens ahead of the hands, driven by
// what a piece is about to ask for.
//
// It is a second capability rather than part of KeyValueStore: that port is small
// synchronous JSON in localStorage, and this is tens of megabytes of audio in a cache. One
// interface serving both would be worse at both.
export interface SampleSource {
    // What the instrument is, once its manifest is known — the recordings' own credit line
    // comes from here. Null until it has been fetched, which is also "no samples yet".
    manifest(): SampleManifest | null;
    // Decoded and ready to sound this instant, or null. Never fetches: the answer to "is
    // this note ready" has to arrive within the same key press that asked.
    bufferFor(region: SampleRegion): AudioBuffer | null;
    // Fetch and decode whatever these notes will need, ahead of the hands that play them.
    // Takes NOTES rather than recordings on purpose: which recording answers a note is a
    // question only the manifest can settle, the manifest lives in here, and a caller made
    // to fetch it first cannot prefetch until something else already has. Resolves when the
    // recordings are playable; failures are not thrown, because a missing one is a note
    // played by the synth rather than an error a player can act on.
    prepare(notes: readonly PlayedNote[]): Promise<void>;
    // Whether this device has the instrument at all — the manifest fetched, some of it
    // cached. What Settings shows and what an export checks before it promises anything.
    state(): SampleState;
    // Fetch the manifest and whatever the given notes need, then keep it. The player's
    // explicit "use the real piano".
    enable(): Promise<void>;
    // Forget every recording and the manifest with them, freeing the cache. The device
    // reset calls this too.
    forget(): Promise<void>;
    // Told when the state changes, so a panel can redraw without polling.
    subscribe(listener: () => void): () => void;
}

export type SampleState = {
    // The player asked for the real piano.
    enabled: boolean;
    // Recordings decoded and playable right now.
    ready: number;
    // Bytes fetched into the cache on this device.
    bytes: number;
    // A fetch is in flight, so a panel can say so rather than looking broken.
    loading: boolean;
};

export const NO_SAMPLES: SampleState = { enabled: false, ready: 0, bytes: 0, loading: false };
