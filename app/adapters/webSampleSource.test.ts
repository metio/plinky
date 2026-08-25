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
        keys: async () => [...held.keys()].map((url) => ({ url }) as Request),
    } as unknown as Cache;
    return { cache, held };
}

function world(
    options: {
        failManifest?: boolean;
        cache?: Cache;
        enabled?: boolean;
        // A pack of a different size, for the one question that needs more than one
        // recording to answer.
        manifest?: SampleManifest;
    } = {},
) {
    const pack = options.manifest ?? MANIFEST;
    const asked: string[] = [];
    const fetcher = (async (input: RequestInfo | URL) => {
        const url = String(input);
        asked.push(url);
        if (url.endsWith("manifest.json")) {
            return options.failManifest
                ? new Response("no", { status: 404 })
                : new Response(JSON.stringify(pack));
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
        enabled: options.enabled ?? true,
    });
    return { source, asked, remembered, decodeAudioData };
}

describe("webSampleSource", () => {
    it("fetches its manifest on a revisit, without waiting to be asked", async () => {
        // The choice lives on the device and the manifest lives in memory, so every reload
        // starts enabled with nothing loaded. Nothing else fetches it: the switch is not
        // touched and no piece is open yet. Without this the panel sat saying "fetching"
        // over work nobody had started.
        const { source, asked } = world();
        await vi.waitFor(() => expect(source.manifest()).not.toBeNull());
        expect(asked).toEqual(["https://samples.test/v1/manifest.json"]);
    });

    it("reports what the device holds, not what this session fetched", async () => {
        // The figure is read off the cache, so it survives a reload — a count that reset
        // would describe a session while claiming to describe a device.
        const { cache } = fakeCache();
        const first = world({ cache });
        await first.source.prepare([NOTE]);
        expect(first.source.state().held).toBe(1);

        const second = world({ cache });
        await vi.waitFor(() => expect(second.source.state().held).toBe(1));
        // And it knew that before decoding anything this time.
        expect(second.source.state().ready).toBe(0);
    });

    it("knows how big the pack is, so a count can be a fraction of it", async () => {
        // "142 recordings" says nothing about whether the instrument is nearly here. The
        // denominator comes off the manifest, and only once it has arrived.
        const { source } = world();
        expect(source.state().wanted).toBe(0);
        await vi.waitFor(() => expect(source.state().wanted).toBe(1));
    });

    it("fetches the whole pack when asked, and nothing it already holds", async () => {
        // For the player who is about to be somewhere without a network. Every file, in
        // batches — and a second run over a full cache asks the network for nothing, which
        // is what makes the button safe to press twice.
        const many: SampleManifest = {
            ...MANIFEST,
            notes: Array.from({ length: 9 }, (_, at) => ({ ...REGION, file: `n${at}.opus` })),
            releases: [{ ...REGION, file: "r0.opus", kind: "knock" as const }],
        };
        const { cache } = fakeCache();
        const { source, asked } = world({ cache, manifest: many });
        await source.fetchAll();
        expect(source.state().held).toBe(10);
        expect(asked.filter((url) => url.endsWith(".opus")).length).toBe(10);

        asked.length = 0;
        await source.fetchAll();
        expect(asked).toEqual([]);
        expect(source.state().held).toBe(10);
    });

    it("gives the space back without turning the instrument off", async () => {
        // A player reclaiming the storage is not asking to go back to the synthesised
        // piano: the choice stays, the manifest stays, and the recordings arrive again with
        // the next piece. That is what makes this a different button from the switch.
        const { cache, held } = fakeCache();
        const deleted: string[] = [];
        vi.stubGlobal("caches", {
            delete: async (name: string) => {
                deleted.push(name);
                held.clear();
                return true;
            },
        });
        try {
            const { source } = world({ cache });
            await source.prepare([NOTE]);
            expect(source.state().held).toBe(1);

            await source.clear();
            expect(deleted).toEqual(["plinky-piano-v1"]);
            expect(source.state()).toMatchObject({ enabled: true, held: 0, ready: 0 });
            expect(source.manifest()).not.toBeNull();
        } finally {
            vi.unstubAllGlobals();
        }
    });

    it("says it is loading only while it is", async () => {
        const { source } = world();
        await vi.waitFor(() => expect(source.manifest()).not.toBeNull());
        expect(source.state().loading).toBe(false);
    });

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
        // Once each: the revisit's own manifest load and this one are the same fetch.
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
        // The default a device starts on: not a request, not a byte, until it is asked for.
        const { source, asked } = world({ enabled: false });
        await source.prepare([NOTE]);
        expect(asked).toEqual([]);
        expect(source.manifest()).toBeNull();
    });

    it("remembers the choice both ways, and forgets what it decoded", async () => {
        const { source, remembered } = world();
        await source.prepare([NOTE]);
        expect(source.state().ready).toBe(1);
        await source.forget();
        expect(remembered.at(-1)).toBe(false);
        expect(source.state()).toMatchObject({ enabled: false, ready: 0, held: 0 });
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
