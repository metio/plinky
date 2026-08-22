// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { SampleManifest, SampleRegion } from "../../core/sampledPiano";
import type { PlayedNote, SampleSource, SampleState } from "../ports/sampleSource";
import { NO_SAMPLES } from "../ports/sampleSource";

// A sample source that holds whatever a test hands it, so a test can say "this note has a
// recording and that one does not" without a network, a cache or an audio context.
export type FakeSampleSource = SampleSource & {
    // Make this recording playable, as if it had been fetched and decoded. `bytes` is what
    // it cost to fetch, for the one figure the panel shows.
    put(file: string, buffer?: AudioBuffer): void;
    // Every prepare() call's notes, in order, so a test can assert that the app looks ahead
    // of the hands rather than fetching a note at a time.
    prepared: PlayedNote[][];
};

export function fakeSampleSource(manifest: SampleManifest | null = null): FakeSampleSource {
    const buffers = new Map<string, AudioBuffer>();
    const listeners = new Set<() => void>();
    let state: SampleState = { ...NO_SAMPLES, enabled: manifest !== null };
    const prepared: PlayedNote[][] = [];
    const announce = () => {
        for (const listener of listeners) {
            listener();
        }
    };
    return {
        prepared,
        put(file, buffer) {
            // The buffer is only ever handed back, never inspected, so a stand-in is
            // enough where a test cares about which recording rather than what is in it.
            buffers.set(file, buffer ?? ({ duration: 1 } as AudioBuffer));
            state = { ...state, ready: buffers.size, held: buffers.size };
            announce();
        },
        manifest: () => manifest,
        bufferFor: (region: SampleRegion) => buffers.get(region.file) ?? null,
        state: () => state,
        subscribe(listener) {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
        async prepare(notes) {
            prepared.push([...notes]);
        },
        async enable() {
            state = { ...state, enabled: true };
            announce();
        },
        async forget() {
            buffers.clear();
            state = { ...NO_SAMPLES };
            announce();
        },
    };
}
