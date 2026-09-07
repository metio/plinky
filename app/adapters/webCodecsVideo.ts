// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import {
    BufferTarget,
    EncodedAudioPacketSource,
    EncodedPacket,
    EncodedVideoPacketSource,
    Mp4OutputFormat,
    Output,
} from "mediabunny";
import type { VideoExporter } from "../ports/videoExporter";
import { frameTimesMs } from "../../core/videoFrames";
import { audioConfig, pickAudioCodec, videoConfig } from "../../core/videoEncoding";
import { renderTakeAudio } from "./offlineAudio";
import { feedAudio, probeAudioCodec, withEncoders } from "./webCodecsAudio";

// The WebCodecs implementation of the video-file seam: frames painted onto an
// OffscreenCanvas go through VideoEncoder (H.264), the soundtrack through
// AudioEncoder (AAC), and mediabunny zips both into an in-memory MP4 — the one
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
        // The whole file assembles in memory, so the moov atom lands up front and the
        // result streams from the first byte. A track whose first chunk sits at a small
        // non-zero time — Firefox's H.264 encoder does this — is shifted to zero and given
        // an edit list, so nothing here has to offset it.
        const output = new Output({
            format: new Mp4OutputFormat({ fastStart: "in-memory" }),
            target: new BufferTarget(),
        });
        const videoSource = new EncodedVideoPacketSource("avc");
        const audioSource = new EncodedAudioPacketSource(audioCodec.container);
        output.addVideoTrack(videoSource, { frameRate: input.fps });
        output.addAudioTrack(audioSource);

        // Encoder errors surface through the callback; keep the first one and
        // fail the export with it rather than hanging on flush.
        let failure: Error | null = null;
        const fail = (error: Error) => {
            failure = failure ?? error;
        };
        // The encoders hand chunks over synchronously and the writer takes packets one at
        // a time in decode order, so each track queues its packets behind the last: the
        // order the encoder emitted is the order the file gets, and the writer's
        // backpressure is honoured before the file is finalised.
        let videoQueue: Promise<void> = Promise.resolve();
        let audioQueue: Promise<void> = Promise.resolve();

        const videoEncoder = new VideoEncoder({
            output: (chunk, meta) => {
                videoQueue = videoQueue
                    .then(() => videoSource.add(EncodedPacket.fromEncodedChunk(chunk), meta))
                    .catch(fail);
            },
            error: fail,
        });
        const audioEncoder = new AudioEncoder({
            output: (chunk, meta) => {
                audioQueue = audioQueue
                    .then(() => audioSource.add(EncodedPacket.fromEncodedChunk(chunk), meta))
                    .catch(fail);
            },
            error: fail,
        });
        await output.start();
        await withEncoders([videoEncoder, audioEncoder], async () => {
            videoEncoder.configure(videoConfig(input));
            audioEncoder.configure(audioConfig(audioCodec.codec, audio));

            // Audio first: it's cheap, and the writer interleaves by timestamp.
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
            await Promise.all([videoQueue, audioQueue]);
        });
        if (failure) {
            throw failure;
        }
        await output.finalize();
        const bytes = output.target.buffer;
        if (!bytes) {
            throw new Error("the writer finalised nothing");
        }
        return new Blob([bytes as BlobPart], { type: "video/mp4" });
    },
};
