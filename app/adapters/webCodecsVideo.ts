// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { ArrayBufferTarget, Muxer } from "mp4-muxer";
import type { VideoExporter } from "../ports/videoExporter";
import { frameTimesMs } from "../../core/videoFrames";
import { audioConfig, pickAudioCodec, videoConfig } from "../../core/videoEncoding";
import { renderTakeAudio } from "./offlineAudio";
import { feedAudio, probeAudioCodec, withEncoders } from "./webCodecsAudio";

// The WebCodecs implementation of the video-file seam: frames painted onto an
// OffscreenCanvas go through VideoEncoder (H.264), the soundtrack through
// AudioEncoder (AAC), and mp4-muxer zips both into an in-memory MP4 — the one
// container that pastes into every chat and social feed. Everything runs
// faster than real time and off the page's audio context. Chromium carries
// both encoders today; supported() asks the engine about the exact
// configurations, so anything less capable simply reports unsupported. The
// configurations themselves are pure arithmetic and live in core/videoEncoding;
// this file is the part that talks to the platform.

// A keyframe every two seconds keeps seeking snappy without bloating the file.
const KEYFRAME_INTERVAL_MS = 2_000;
// Feed audio in ~85ms slabs — small enough to interleave well with frames.
export const webCodecsVideoExporter: VideoExporter = {
    async supported() {
        if (typeof VideoEncoder === "undefined" || typeof AudioEncoder === "undefined") {
            return false;
        }
        try {
            const video = await VideoEncoder.isConfigSupported(
                videoConfig({ width: 1280, height: 720, fps: 30 }),
            );
            return video.supported === true && (await pickAudioCodec(probeAudioCodec)) !== null;
        } catch {
            return false;
        }
    },

    async export(input, onProgress) {
        const audio = await renderTakeAudio(input.notes);
        const audioCodec = await pickAudioCodec(probeAudioCodec);
        if (!audioCodec) {
            throw new Error("no encodable audio codec; supported() would have said no");
        }
        const muxer = new Muxer({
            target: new ArrayBufferTarget(),
            video: { codec: "avc", width: input.width, height: input.height },
            audio: {
                codec: audioCodec.container,
                sampleRate: audio.sampleRate,
                numberOfChannels: audio.numberOfChannels,
            },
            // The whole file assembles in memory, so the moov atom lands up
            // front and the result streams from the first byte.
            fastStart: "in-memory",
            // Firefox's H.264 encoder emits its first chunk with a small
            // non-zero DTS, which the muxer's default strict mode rejects
            // (killing the whole export); offsetting each track so its first
            // sample sits at zero is a no-op on engines that already emit 0.
            firstTimestampBehavior: "offset",
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
        const audioEncoder = new AudioEncoder({
            output: (chunk, meta) => muxer.addAudioChunk(chunk, meta),
            error: fail,
        });
        await withEncoders([videoEncoder, audioEncoder], async () => {
            videoEncoder.configure(videoConfig(input));
            audioEncoder.configure(audioConfig(audioCodec.codec, audio));

            // Audio first: it's cheap, and the muxer interleaves by timestamp.
            feedAudio(audioEncoder, audio);

            const canvas = new OffscreenCanvas(input.width, input.height);
            const context = canvas.getContext("2d");
            if (!context) {
                throw new Error("no 2d context for the export canvas");
            }
            const times = frameTimesMs(input.durationMs, input.fps);
            let lastKeyframeMs = Number.NEGATIVE_INFINITY;
            for (let index = 0; index < times.length; index++) {
                // An encoder that has reported an error has closed itself; the next
                // encode into it would throw a generic error in place of the recorded one.
                if (failure) {
                    throw failure;
                }
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

            if (failure) {
                throw failure;
            }
            await Promise.all([videoEncoder.flush(), audioEncoder.flush()]);
        });
        if (failure) {
            throw failure;
        }
        muxer.finalize();
        return new Blob([muxer.target.buffer], { type: "video/mp4" });
    },
};
