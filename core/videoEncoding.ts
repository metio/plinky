// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// The encoder-independent half of a video export: which codec at which bitrate,
// and how a rendered soundtrack is re-laid for the audio encoder. Everything
// here is a plain calculation over plain data — the WebCodecs adapter feeds the
// results to the real encoders, and these shapes describe exactly the fields
// those encoders read, structurally, so this layer stays free of DOM types.

// H.264 High profile — level 4.0 comfortably covers 720p (and 1080p30);
// 1080p60 needs level 4.2. Both hardware-decode everywhere a video might be
// shared.
const VIDEO_CODEC_L40 = "avc1.640028";
const VIDEO_CODEC_L42 = "avc1.64002a";
// The 720p30 reference bitrate; more pixels or frames scale it up so 1080p60
// doesn't smear at a 720p budget.
const VIDEO_BITRATE = 6_000_000;
const REFERENCE_LOAD = 1280 * 720 * 30;
// The pixel-rate multiple past which level 4.0 no longer suffices.
const LEVEL_42_LOAD = 3;
const AUDIO_BITRATE = 192_000;

export type VideoShape = { width: number; height: number; fps: number };

export type VideoEncodingConfig = {
    codec: string;
    width: number;
    height: number;
    bitrate: number;
    framerate: number;
};

export type AudioShape = { sampleRate: number; numberOfChannels: number };

export type AudioEncodingConfig = {
    codec: string;
    sampleRate: number;
    numberOfChannels: number;
    bitrate: number;
};

// An audio codec paired with the name mp4-muxer knows it by.
export type AudioCodecChoice = { codec: string; container: "aac" | "opus" };

// AAC-LC, the plain stereo audio every player expects inside an MP4, comes
// first — but the AAC encoder is licensed and plain Chromium ships without it,
// so Opus (which mp4-muxer can also carry in an MP4, and every modern player
// decodes) is the fallback that keeps the export working there. Order is the
// preference: the first codec the engine can encode wins.
export const AUDIO_CODECS: readonly AudioCodecChoice[] = [
    { codec: "mp4a.40.2", container: "aac" },
    { codec: "opus", container: "opus" },
];

export function videoConfig(input: VideoShape): VideoEncodingConfig {
    const load = (input.width * input.height * input.fps) / REFERENCE_LOAD;
    return {
        codec: load > LEVEL_42_LOAD ? VIDEO_CODEC_L42 : VIDEO_CODEC_L40,
        width: input.width,
        height: input.height,
        // A take smaller than the reference still gets the full reference
        // bitrate: below it the encoder is already transparent, and clamping
        // keeps small frames from being starved.
        bitrate: Math.round(VIDEO_BITRATE * Math.max(1, load)),
        framerate: input.fps,
    };
}

export function audioConfig(codec: string, audio: AudioShape): AudioEncodingConfig {
    return {
        codec,
        sampleRate: audio.sampleRate,
        numberOfChannels: audio.numberOfChannels,
        bitrate: AUDIO_BITRATE,
    };
}

// The first codec in `candidates` the engine accepts, or null when it accepts
// none. The probe is the caller's — the platform question lives with the
// platform — and a probe that rejects counts as a no: an unknown codec string
// makes the real encoder throw, and the next candidate deserves its turn.
export async function pickAudioCodec(
    probe: (choice: AudioCodecChoice) => Promise<boolean>,
    candidates: readonly AudioCodecChoice[] = AUDIO_CODECS,
): Promise<AudioCodecChoice | null> {
    for (const choice of candidates) {
        try {
            if (await probe(choice)) {
                return choice;
            }
        } catch {
            // An unknown codec string throws; try the next one.
        }
    }
    return null;
}

// The channels of a rendered take. An AudioBuffer satisfies this structurally;
// so does a hand-built stub.
export type PlanarSource = {
    numberOfChannels: number;
    getChannelData(channel: number): Float32Array;
};

// The source's channels re-laid as the planar float frames an audio encoder
// expects — every frame of channel 0, then every frame of channel 1 — sliced
// from `from` for `count` frames.
export function planarSlice(
    audio: PlanarSource,
    from: number,
    count: number,
): Float32Array<ArrayBuffer> {
    const channels = audio.numberOfChannels;
    const out = new Float32Array(count * channels);
    for (let channel = 0; channel < channels; channel++) {
        out.set(audio.getChannelData(channel).subarray(from, from + count), channel * count);
    }
    return out;
}
