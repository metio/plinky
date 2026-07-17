// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it, vi } from "vitest";
import {
    type AudioCodecChoice,
    AUDIO_CODECS,
    audioConfig,
    pickAudioCodec,
    planarSlice,
    videoConfig,
} from "./videoEncoding";

describe("videoConfig", () => {
    it("holds the reference bitrate at and below 720p30", () => {
        expect(videoConfig({ width: 1280, height: 720, fps: 30 })).toEqual({
            codec: "avc1.640028",
            width: 1280,
            height: 720,
            bitrate: 6_000_000,
            framerate: 30,
        });
        expect(videoConfig({ width: 640, height: 360, fps: 30 }).bitrate).toBe(6_000_000);
    });

    it("scales the bitrate with the pixel rate", () => {
        expect(videoConfig({ width: 1280, height: 720, fps: 60 }).bitrate).toBe(12_000_000);
        expect(videoConfig({ width: 1920, height: 1080, fps: 30 }).bitrate).toBe(13_500_000);
    });

    it("steps up to level 4.2 only past three times the reference load", () => {
        // 1080p30 is 2.25x — level 4.0 still covers it.
        expect(videoConfig({ width: 1920, height: 1080, fps: 30 }).codec).toBe("avc1.640028");
        // 1080p60 is 4.5x, and needs 4.2.
        expect(videoConfig({ width: 1920, height: 1080, fps: 60 }).codec).toBe("avc1.64002a");
    });

    it("carries the frame shape through untouched", () => {
        const config = videoConfig({ width: 800, height: 600, fps: 24 });
        expect(config).toMatchObject({ width: 800, height: 600, framerate: 24 });
    });
});

describe("audioConfig", () => {
    it("describes the take's own stream at the fixed bitrate", () => {
        expect(audioConfig("opus", { sampleRate: 48_000, numberOfChannels: 2 })).toEqual({
            codec: "opus",
            sampleRate: 48_000,
            numberOfChannels: 2,
            bitrate: 192_000,
        });
    });
});

describe("pickAudioCodec", () => {
    it("prefers AAC when the engine encodes it", async () => {
        expect(await pickAudioCodec(async () => true)).toEqual({
            codec: "mp4a.40.2",
            container: "aac",
        });
    });

    it("falls back to Opus on an engine without the licensed AAC encoder", async () => {
        const probe = vi.fn(async (choice: AudioCodecChoice) => choice.codec === "opus");

        expect(await pickAudioCodec(probe)).toEqual({ codec: "opus", container: "opus" });
        expect(probe).toHaveBeenCalledTimes(2);
    });

    it("treats a throwing probe as a no and tries the next candidate", async () => {
        const probe = async (choice: AudioCodecChoice) => {
            if (choice.codec === "mp4a.40.2") {
                throw new TypeError("unknown codec");
            }
            return true;
        };

        expect(await pickAudioCodec(probe)).toEqual({ codec: "opus", container: "opus" });
    });

    it("returns null when the engine encodes nothing", async () => {
        expect(await pickAudioCodec(async () => false)).toBeNull();
    });

    it("asks about each candidate in preference order, stopping at the first yes", async () => {
        const asked: string[] = [];
        await pickAudioCodec(async (choice) => {
            asked.push(choice.codec);
            return false;
        });

        expect(asked).toEqual(AUDIO_CODECS.map((choice) => choice.codec));
    });
});

describe("planarSlice", () => {
    const source = (channels: number[][]) => ({
        numberOfChannels: channels.length,
        getChannelData: (channel: number) => Float32Array.from(channels[channel] ?? []),
    });

    it("lays the channels end to end, one whole channel at a time", () => {
        const audio = source([
            [1, 2, 3, 4],
            [5, 6, 7, 8],
        ]);

        expect([...planarSlice(audio, 0, 4)]).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    });

    it("slices the same window out of every channel", () => {
        const audio = source([
            [1, 2, 3, 4],
            [5, 6, 7, 8],
        ]);

        expect([...planarSlice(audio, 1, 2)]).toEqual([2, 3, 6, 7]);
    });

    it("zero-fills a window that runs past the end of the take", () => {
        const audio = source([
            [1, 2, 3],
            [4, 5, 6],
        ]);

        expect([...planarSlice(audio, 2, 3)]).toEqual([3, 0, 0, 6, 0, 0]);
    });

    it("handles a mono take", () => {
        expect([...planarSlice(source([[1, 2]]), 0, 2)]).toEqual([1, 2]);
    });
});
