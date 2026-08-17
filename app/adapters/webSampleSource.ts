// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { SampleManifest, SampleRegion } from "../../core/sampledPiano";
import { regionsNeeded } from "../../core/sampledPiano";
import type { PlayedNote, SampleSource, SampleState } from "../ports/sampleSource";
import { NO_SAMPLES } from "../ports/sampleSource";

// The real piano, fetched a recording at a time and kept in the browser's cache.
//
// Cache Storage rather than a bundled asset or one big archive: each recording is a URL,
// so the cache keeps exactly what has been played and nothing else, a second visit fetches
// nothing, and the pack can be updated by publishing a new version path without a single
// stale byte surviving. Measured over the catalogue, a piece asks for a couple of dozen
// recordings — three for a first study, two dozen for a grade 8 — and a player who works
// through sixteen pieces has fetched under 5 MB, because pieces reuse the same notes.
//
// Storage is a cache, never a filesystem: the browser may evict any of it at any time, and
// everything here treats a miss as "fetch it again", never as an error. What cannot be
// re-fetched is not kept here.

const CACHE = "plinky-piano-v1";

export type WebSampleOptions = {
    // Where the pack lives. Its version is part of the path, so a new pack is a new URL
    // rather than an edit a cache cannot see.
    baseUrl: string;
    // Injected so tests can hand over a context they control, and so the engine's own
    // context is the one that decodes — an AudioBuffer belongs to the context that made it.
    context: () => Promise<BaseAudioContext | null>;
    // Injected for the same reason `fetch` is anywhere else in this app: a test should not
    // have to reach for a global to say what the network did.
    fetcher?: typeof fetch;
    // Where fetched recordings are kept. Cache Storage in a browser; a test hands over its
    // own, and a browser without one gets null and simply never has the instrument.
    cache?: () => Promise<Cache | null>;
    // Remembers the player's choice across visits. The recordings live in the cache; this
    // is the one bit that says whether to use them.
    remember: (enabled: boolean) => void;
    enabled: boolean;
};

export function webSampleSource(options: WebSampleOptions): SampleSource {
    const fetcher = options.fetcher ?? fetch;
    const buffers = new Map<string, AudioBuffer>();
    const listeners = new Set<() => void>();
    let manifest: SampleManifest | null = null;
    let state: SampleState = { ...NO_SAMPLES, enabled: options.enabled };
    // One in-flight fetch per recording: a piece whose notes repeat asks for the same file
    // many times in the same instant, and a cache miss must not become twenty requests.
    const inFlight = new Map<string, Promise<void>>();

    const announce = () => {
        for (const listener of listeners) {
            listener();
        }
    };
    const settle = (next: Partial<SampleState>) => {
        state = { ...state, ...next };
        announce();
    };

    const cache =
        options.cache ??
        (async () => {
            try {
                return await caches.open(CACHE);
            } catch {
                // No Cache Storage (a private window on some browsers, an old engine): the
                // instrument simply never becomes available and the synth keeps playing.
                return null;
            }
        });

    // From the cache if it is there, from the network if it is not, and into the cache
    // either way. Returns null rather than throwing: a recording that will not arrive is a
    // note the synth plays.
    async function bytesFor(path: string): Promise<ArrayBuffer | null> {
        const url = `${options.baseUrl}/${path}`;
        const store = await cache();
        try {
            const hit = await store?.match(url);
            if (hit) {
                return await hit.arrayBuffer();
            }
            const response = await fetcher(url);
            if (!response.ok) {
                return null;
            }
            await store?.put(url, response.clone());
            return await response.arrayBuffer();
        } catch {
            return null;
        }
    }

    async function loadManifest(): Promise<SampleManifest | null> {
        if (manifest) {
            return manifest;
        }
        const bytes = await bytesFor("manifest.json");
        if (!bytes) {
            return null;
        }
        try {
            manifest = JSON.parse(new TextDecoder().decode(bytes)) as SampleManifest;
        } catch {
            return null;
        }
        announce();
        return manifest;
    }

    async function decode(region: SampleRegion): Promise<void> {
        if (buffers.has(region.file) || inFlight.has(region.file)) {
            await inFlight.get(region.file);
            return;
        }
        const work = (async () => {
            const bytes = await bytesFor(region.file);
            const context = await options.context();
            if (!bytes || !context) {
                return;
            }
            try {
                // decodeAudioData detaches the buffer it is given, so the size is read off
                // it first — after this call the length is zero.
                const size = bytes.byteLength;
                const decoded = await context.decodeAudioData(bytes);
                buffers.set(region.file, decoded);
                settle({ ready: buffers.size, bytes: state.bytes + size });
            } catch {
                // A recording that will not decode is one the synth covers.
            }
        })();
        inFlight.set(region.file, work);
        try {
            await work;
        } finally {
            inFlight.delete(region.file);
        }
    }

    return {
        manifest: () => manifest,
        bufferFor: (region) => buffers.get(region.file) ?? null,
        state: () => state,
        subscribe: (listener) => {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
        async prepare(notes: readonly PlayedNote[]) {
            if (!state.enabled || notes.length === 0) {
                return;
            }
            // The manifest first, always: it is what turns a note into a recording, and on
            // any page load it is not here yet.
            const found = await loadManifest();
            if (!found) {
                return;
            }
            settle({ loading: true });
            try {
                await Promise.all(
                    regionsNeeded(found.notes, notes).map((region) => decode(region)),
                );
            } finally {
                settle({ loading: false });
            }
        },
        async enable() {
            options.remember(true);
            settle({ enabled: true, loading: true });
            try {
                await loadManifest();
            } finally {
                settle({ loading: false });
            }
        },
        async forget() {
            options.remember(false);
            buffers.clear();
            manifest = null;
            try {
                await caches.delete(CACHE);
            } catch {
                // Nothing to delete, or no cache to delete it from.
            }
            settle({ enabled: false, ready: 0, bytes: 0, loading: false });
        },
    };
}
