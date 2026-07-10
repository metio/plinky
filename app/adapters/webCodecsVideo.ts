// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { ArrayBufferTarget, Muxer } from "mp4-muxer";
import type { VideoExporter, VideoExportInput } from "../ports/videoExporter";
import { frameTimesMs } from "../../core/videoFrames";

// The WebCodecs implementation of the video-file seam: frames painted onto an
// OffscreenCanvas go through VideoEncoder (H.264), the soundtrack through
// AudioEncoder (AAC), and mp4-muxer zips both into an in-memory MP4 — the one
// container that pastes into every chat and social feed. Everything runs
// faster than real time and off the page's audio context. Chromium carries
// both encoders today; supported() asks the engine about the exact
// configurations, so anything less capable simply reports unsupported.

// H.264 High profile, level 4.0 — comfortably covers 720p at any fps we ask
// for, and hardware-decodes everywhere a video might be shared.
const VIDEO_CODEC = "avc1.640028";
// AAC-LC, the plain stereo audio every player expects inside an MP4.
const AUDIO_CODEC = "mp4a.40.2";
const AUDIO_BITRATE = 192_000;
const VIDEO_BITRATE = 6_000_000;
// A keyframe every two seconds keeps seeking snappy without bloating the file.
const KEYFRAME_INTERVAL_MS = 2_000;
// Feed audio in ~85ms slabs — small enough to interleave well with frames.
const AUDIO_CHUNK_FRAMES = 4_096;

function videoConfig(input: Pick<VideoExportInput, "width" | "height" | "fps">) {
    return {
        codec: VIDEO_CODEC,
        width: input.width,
        height: input.height,
        bitrate: VIDEO_BITRATE,
        framerate: input.fps,
    } satisfies VideoEncoderConfig;
}

function audioConfig(audio: AudioBuffer) {
    return {
        codec: AUDIO_CODEC,
        sampleRate: audio.sampleRate,
        numberOfChannels: audio.numberOfChannels,
        bitrate: AUDIO_BITRATE,
    } satisfies AudioEncoderConfig;
}

// The AudioBuffer's channels, re-laid as the planar float frames AudioData
// expects, sliced from `from` for `count` frames.
function planarSlice(audio: AudioBuffer, from: number, count: number): Float32Array<ArrayBuffer> {
    const channels = audio.numberOfChannels;
    const out = new Float32Array(count * channels);
    for (let channel = 0; channel < channels; channel++) {
        out.set(audio.getChannelData(channel).subarray(from, from + count), channel * count);
    }
    return out;
}

export const webCodecsVideoExporter: VideoExporter = {
    async supported() {
        if (typeof VideoEncoder === "undefined" || typeof AudioEncoder === "undefined") {
            return false;
        }
        try {
            const [video, audio] = await Promise.all([
                VideoEncoder.isConfigSupported(videoConfig({ width: 1280, height: 720, fps: 30 })),
                AudioEncoder.isConfigSupported({
                    codec: AUDIO_CODEC,
                    sampleRate: 48_000,
                    numberOfChannels: 2,
                    bitrate: AUDIO_BITRATE,
                }),
            ]);
            return video.supported === true && audio.supported === true;
        } catch {
            return false;
        }
    },

    async export(input, onProgress) {
        const muxer = new Muxer({
            target: new ArrayBufferTarget(),
            video: { codec: "avc", width: input.width, height: input.height },
            audio: {
                codec: "aac",
                sampleRate: input.audio.sampleRate,
                numberOfChannels: input.audio.numberOfChannels,
            },
            // The whole file assembles in memory, so the moov atom lands up
            // front and the result streams from the first byte.
            fastStart: "in-memory",
        });

        // Encoder errors surface through the callback; keep the first one and
        // fail the export with it rather than hanging on flush.
        let failure: Error | null = null;
        const fail = (error: Error) => {
            failure = failure ?? error;
        };

        const videoEncoder = new VideoEncoder({
            output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
            error: fail,
        });
        videoEncoder.configure(videoConfig(input));
        const audioEncoder = new AudioEncoder({
            output: (chunk, meta) => muxer.addAudioChunk(chunk, meta),
            error: fail,
        });
        audioEncoder.configure(audioConfig(input.audio));

        // Audio first: it's cheap, and the muxer interleaves by timestamp.
        for (let from = 0; from < input.audio.length; from += AUDIO_CHUNK_FRAMES) {
            const count = Math.min(AUDIO_CHUNK_FRAMES, input.audio.length - from);
            const data = new AudioData({
                format: "f32-planar",
                sampleRate: input.audio.sampleRate,
                numberOfFrames: count,
                numberOfChannels: input.audio.numberOfChannels,
                timestamp: Math.round((from / input.audio.sampleRate) * 1_000_000),
                data: planarSlice(input.audio, from, count),
            });
            audioEncoder.encode(data);
            data.close();
        }

        const canvas = new OffscreenCanvas(input.width, input.height);
        const context = canvas.getContext("2d");
        if (!context) {
            throw new Error("no 2d context for the export canvas");
        }
        const times = frameTimesMs(input.durationMs, input.fps);
        let lastKeyframeMs = Number.NEGATIVE_INFINITY;
        for (let index = 0; index < times.length; index++) {
            const timeMs = times[index]!;
            input.paint(context, timeMs);
            const frame = new VideoFrame(canvas, {
                timestamp: Math.round(timeMs * 1_000),
                duration: Math.round(1_000_000 / input.fps),
            });
            const keyFrame = timeMs - lastKeyframeMs >= KEYFRAME_INTERVAL_MS;
            if (keyFrame) {
                lastKeyframeMs = timeMs;
            }
            videoEncoder.encode(frame, { keyFrame });
            frame.close();
            // Encoders queue internally; letting the queue drain now and then
            // keeps memory flat on long takes.
            if (videoEncoder.encodeQueueSize > input.fps) {
                await videoEncoder.flush();
            }
            onProgress?.((index + 1) / times.length);
        }

        await Promise.all([videoEncoder.flush(), audioEncoder.flush()]);
        videoEncoder.close();
        audioEncoder.close();
        if (failure) {
            throw failure;
        }
        muxer.finalize();
        return new Blob([muxer.target.buffer], { type: "video/mp4" });
    },
};
