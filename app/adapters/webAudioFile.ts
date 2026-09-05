// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { ArrayBufferTarget, Muxer } from "mp4-muxer";
import type { AudioExport, AudioExporter } from "../ports/audioExporter";
import { type AudioCodecChoice, audioConfig, pickAudioCodec } from "../../core/videoEncoding";
import { wavBytes } from "../../core/wavFile";
import { renderTakeAudio } from "./offlineAudio";
import { feedAudio, probeAudioCodec, withEncoders } from "./webCodecsAudio";

// The platform half of the audio-file seam: the same offline render the video export
// sounds, encoded on its own.
//
// Everything here is already in the building. renderTakeAudio produces the take's audio,
// core/videoEncoding picks the codec the engine will take, and mp4-muxer writes the
// container — the video export is these three plus a picture. So an audio file is not a
// second renderer with its own idea of how a take sounds; it is the same take, minus the
// frames, and a person who exports both gets two files that agree.
//
// MP3 is not among the choices, and cannot be: every engine decodes it and none encodes it.
// Offering it would mean shipping an encoder to produce a format larger than AAC at the
// same quality and no more playable.

// Feed the encoder in ~85ms slabs, as the video export does.
// The take as an MP4 holding nothing but sound — an .m4a, which is what that is called.
async function encoded(audio: AudioBuffer, codec: AudioCodecChoice): Promise<Blob> {
    const muxer = new Muxer({
        target: new ArrayBufferTarget(),
        audio: {
            codec: codec.container,
            sampleRate: audio.sampleRate,
            numberOfChannels: audio.numberOfChannels,
        },
        fastStart: "in-memory",
        // Some engines emit a first chunk at a small non-zero timestamp, which the muxer's
        // strict mode rejects outright; offsetting is a no-op where the first chunk is
        // already at zero. The video export needs this for the same reason.
        firstTimestampBehavior: "offset",
    });

    let failure: Error | null = null;
    const encoder = new AudioEncoder({
        output: (chunk, meta) => muxer.addAudioChunk(chunk, meta),
        error: (error) => {
            failure = failure ?? error;
        },
    });
    await withEncoders([encoder], async () => {
        encoder.configure(audioConfig(codec.codec, audio));
        feedAudio(encoder, audio);
        if (failure) {
            throw failure;
        }
        await encoder.flush();
    });
    if (failure) {
        throw failure;
    }
    muxer.finalize();
    return new Blob([muxer.target.buffer], { type: "audio/mp4" });
}

export const webAudioFileExporter: AudioExporter = {
    async export(notes): Promise<AudioExport> {
        const audio = await renderTakeAudio(notes);
        const codec = await pickAudioCodec(probeAudioCodec);
        if (codec) {
            try {
                return { blob: await encoded(audio, codec), extension: "m4a" };
            } catch {
                // The probe said yes and the encoder said no — a configuration accepted in
                // principle and refused in practice, or a muxer that would not take the
                // chunks. Falling through to WAV is better than failing an export that a
                // format needing no encoder at all can still satisfy.
            }
        }
        return {
            blob: new Blob([wavBytes(audio) as BlobPart], { type: "audio/wav" }),
            extension: "wav",
        };
    },
};
