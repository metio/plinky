// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it, vi } from "vitest";
import type { SampleManifest, SampleRegion } from "../../core/sampledPiano";
import { webSampleSource } from "./webSampleSource";

const MANIFEST: SampleManifest = {
    instrument: "Salamander Grand Piano V3",
    author: "Alexander Holm",
    license: "CC-BY-3.0",
    source: "https://example.test",
    version: "v1",
    notes: [
        {
            file: "C4v4.opus",
            keyCentre: 60,
            lowKey: 59,
            highKey: 61,
            lowVelocity: 1,
            highVelocity: 127,
        },
    ],
    releases: [],
};

const REGION: SampleRegion = MANIFEST.notes[0]!;

// A note the one recording in this manifest answers.
const NOTE = { pitch: 60, velocity: 100 };

// A cache that remembers what it was given, so a second run can be shown to ask the
// network for nothing.
function fakeCache() {
    const held = new Map<string, Response>();
    const cache = {
        match: async (url: string) => held.get(url)?.clone(),
        put: async (url: string, response: Response) => {
            held.set(url, response);
        },
    } as unknown as Cache;
    return { cache, held };
}

function world(options: { failManifest?: boolean; cache?: Cache } = {}) {
    const asked: string[] = [];
    const fetcher = (async (input: RequestInfo | URL) => {
        const url = String(input);
        asked.push(url);
        if (url.endsWith("manifest.json")) {
            return options.failManifest
                ? new Response("no", { status: 404 })
                : new Response(JSON.stringify(MANIFEST));
        }
        return new Response(new Uint8Array([1, 2, 3, 4]).buffer);
    }) as unknown as typeof fetch;
    const remembered: boolean[] = [];
    const decodeAudioData = vi.fn(async () => ({ duration: 1 }) as AudioBuffer);
    const source = webSampleSource({
        baseUrl: "https://samples.test/v1",
        fetcher,
        cache: async () => options.cache ?? null,
        context: async () => ({ decodeAudioData }) as unknown as BaseAudioContext,
        remember: (enabled) => remembered.push(enabled),
        enabled: true,
    });
    return { source, asked, remembered, decodeAudioData };
}

describe("webSampleSource", () => {
    it("maps a note to its recording itself, so a caller needs no manifest first", async () => {
        // The port takes notes rather than recordings for exactly this reason: on any page
        // load the manifest is not here yet, and a caller made to fetch it before it can
        // prefetch simply never prefetches.
        const { source, asked } = world();
        await source.prepare([NOTE]);
        expect(asked.at(-1)).toBe("https://samples.test/v1/C4v4.opus");
    });

    it("has nothing to play until a recording has been prepared", () => {
        const { source } = world();
        expect(source.bufferFor(REGION)).toBeNull();
        expect(source.manifest()).toBeNull();
    });

    it("fetches the manifest and the recordings a piece asked for", async () => {
        const { source, asked } = world();
        await source.prepare([NOTE]);
        expect(asked).toEqual([
            "https://samples.test/v1/manifest.json",
            "https://samples.test/v1/C4v4.opus",
        ]);
        expect(source.bufferFor(REGION)).not.toBeNull();
        expect(source.state().ready).toBe(1);
    });

    it("asks for a recording once, however many notes want it", async () => {
        const { source, asked } = world();
        await Promise.all([source.prepare([NOTE]), source.prepare([NOTE])]);
        await source.prepare([NOTE]);
        expect(asked.filter((url) => url.endsWith("C4v4.opus"))).toHaveLength(1);
    });

    it("takes a second visit's recordings from the cache instead of the network", async () => {
        const { cache } = fakeCache();
        const first = world({ cache });
        await first.source.prepare([NOTE]);
        const second = world({ cache });
        await second.source.prepare([NOTE]);
        // The manifest and the recording both came from the cache this time.
        expect(second.asked).toEqual([]);
        expect(second.source.bufferFor(REGION)).not.toBeNull();
    });

    it("stays quiet rather than failing when the recordings cannot be reached", async () => {
        const { source } = world({ failManifest: true });
        await source.prepare([NOTE]);
        expect(source.manifest()).toBeNull();
        expect(source.bufferFor(REGION)).toBeNull();
        // Nothing threw: a piece with no recordings is a piece the synth plays.
        expect(source.state().ready).toBe(0);
    });

    it("fetches nothing at all until the player has asked for the real piano", async () => {
        const { source, asked } = world();
        await source.forget();
        await source.prepare([NOTE]);
        expect(asked).toEqual([]);
    });

    it("remembers the choice both ways, and forgets what it decoded", async () => {
        const { source, remembered } = world();
        await source.prepare([NOTE]);
        expect(source.state().ready).toBe(1);
        await source.forget();
        expect(remembered.at(-1)).toBe(false);
        expect(source.state()).toMatchObject({ enabled: false, ready: 0, bytes: 0 });
        await source.enable();
        expect(remembered.at(-1)).toBe(true);
        expect(source.state().enabled).toBe(true);
    });

    it("tells a listener when there is something new to say", async () => {
        const { source } = world();
        const seen: number[] = [];
        const stop = source.subscribe(() => seen.push(source.state().ready));
        await source.prepare([NOTE]);
        expect(seen.at(-1)).toBe(1);
        stop();
        await source.forget();
        expect(seen.at(-1)).toBe(1);
    });
});
