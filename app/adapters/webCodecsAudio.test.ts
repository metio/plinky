// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { afterEach, describe, expect, it, vi } from "vitest";
import { AUDIO_CHUNK_FRAMES, feedAudio, withEncoders } from "./webCodecsAudio";

// An AudioData that records what it was made with, standing in for the platform's.
class FakeAudioData {
    closed = false;
    constructor(readonly init: { numberOfFrames: number; timestamp: number }) {}
    close() {
        this.closed = true;
    }
}

function encoder(state: "configured" | "closed" = "configured") {
    const fed: FakeAudioData[] = [];
    let closes = 0;
    return {
        fed,
        get state() {
            return state;
        },
        encode(data: unknown) {
            fed.push(data as FakeAudioData);
        },
        close() {
            closes += 1;
            state = "closed";
        },
        closes: () => closes,
        fail: () => {
            state = "closed";
        },
    };
}

const audio = (length: number) => ({
    length,
    sampleRate: 48_000,
    numberOfChannels: 2,
    getChannelData: () => new Float32Array(length),
});

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("feedAudio", () => {
    it("hands the buffer over in chunks stamped in microseconds", () => {
        vi.stubGlobal("AudioData", FakeAudioData);
        const target = encoder();
        feedAudio(target, audio(AUDIO_CHUNK_FRAMES * 2 + 10));
        expect(target.fed.map((data) => data.init.numberOfFrames)).toEqual([
            AUDIO_CHUNK_FRAMES,
            AUDIO_CHUNK_FRAMES,
            10,
        ]);
        expect(target.fed[1]?.init.timestamp).toBe(
            Math.round((AUDIO_CHUNK_FRAMES / 48_000) * 1_000_000),
        );
        expect(target.fed.every((data) => data.closed)).toBe(true);
    });

    it("stops feeding an encoder that has closed on an error", () => {
        vi.stubGlobal("AudioData", FakeAudioData);
        const target = encoder();
        const original = target.encode.bind(target);
        target.encode = (data: unknown) => {
            original(data);
            target.fail();
        };
        feedAudio(target, audio(AUDIO_CHUNK_FRAMES * 3));
        expect(target.fed).toHaveLength(1);
    });
});

describe("withEncoders", () => {
    it("closes every encoder when the encode throws, and once only", async () => {
        const one = encoder();
        const other = encoder();
        await expect(
            withEncoders([one, other], async () => {
                throw new Error("the painter threw");
            }),
        ).rejects.toThrow("the painter threw");
        expect(one.closes()).toBe(1);
        expect(other.closes()).toBe(1);
    });

    it("leaves an encoder already closed by its own error alone", async () => {
        const one = encoder("closed");
        await withEncoders([one], async () => "done");
        expect(one.closes()).toBe(0);
    });

    it("hands back what the encode produced", async () => {
        const one = encoder();
        await expect(withEncoders([one], async () => 42)).resolves.toBe(42);
        expect(one.state).toBe("closed");
    });
});
