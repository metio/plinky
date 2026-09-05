// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { type AudioCodecChoice, audioConfig, planarSlice } from "../../core/videoEncoding";
import { EXPORT_SAMPLE_RATE } from "./offlineAudio";

// What the two WebCodecs exports — a take as sound, a take as video — share about sound:
// the probe that says whether a codec can be encoded here, the feeding of a rendered
// buffer into an encoder, and the guarantee that an encoder is closed however the encode
// ends. One copy, so the two exports the file headers promise agree cannot drift.

// Frames per AudioData handed to the encoder; a few of these a second at 48 kHz.
export const AUDIO_CHUNK_FRAMES = 4_096;

export const probeAudioCodec = async (choice: AudioCodecChoice): Promise<boolean> => {
    if (typeof AudioEncoder === "undefined") {
        return false;
    }
    const check = await AudioEncoder.isConfigSupported(
        audioConfig(choice.codec, { sampleRate: EXPORT_SAMPLE_RATE, numberOfChannels: 2 }),
    );
    return check.supported === true;
};

// The slice of an encoder the helpers below touch: WebCodecs' encoders both have it.
export type Closable = { readonly state: "unconfigured" | "configured" | "closed"; close(): void };

type FeedableEncoder = Closable & { encode(data: AudioData): void };

type PlanarAudio = Parameters<typeof planarSlice>[0] & {
    length: number;
    sampleRate: number;
    numberOfChannels: number;
};

// Hands the whole buffer to a configured encoder as planar chunks with microsecond
// timestamps. Stops at the first chunk the encoder will not take: an encoder that has
// reported an error is closed, and encoding into a closed one throws a generic error in
// place of the one it recorded.
export function feedAudio(encoder: FeedableEncoder, audio: PlanarAudio): void {
    for (let from = 0; from < audio.length; from += AUDIO_CHUNK_FRAMES) {
        if (encoder.state !== "configured") {
            return;
        }
        const count = Math.min(AUDIO_CHUNK_FRAMES, audio.length - from);
        const data = new AudioData({
            format: "f32-planar",
            sampleRate: audio.sampleRate,
            numberOfFrames: count,
            numberOfChannels: audio.numberOfChannels,
            timestamp: Math.round((from / audio.sampleRate) * 1_000_000),
            data: planarSlice(audio, from, count),
        });
        encoder.encode(data);
        data.close();
    }
}

// Runs an encode and closes every encoder it was given afterwards, on failure as much as
// on success. A codec instance is hardware the browser lends a page a handful of at a
// time; one left open by a painter that threw or a configuration the probe accepted and
// the encoder refused is a session gone until the tab closes.
export async function withEncoders<T>(
    encoders: readonly Closable[],
    run: () => Promise<T>,
): Promise<T> {
    try {
        return await run();
    } finally {
        for (const encoder of encoders) {
            if (encoder.state !== "closed") {
                encoder.close();
            }
        }
    }
}
