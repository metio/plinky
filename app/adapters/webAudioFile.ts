// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import {
    BufferTarget,
    EncodedAudioPacketSource,
    EncodedPacket,
    Mp4OutputFormat,
    Output,
} from "mediabunny";
import type { AudioExport, AudioExporter } from "../ports/audioExporter";
import { type AudioCodecChoice, audioConfig, pickAudioCodec } from "../../core/videoEncoding";
import { wavBytes } from "../../core/wavFile";
import { renderTakeAudio } from "./offlineAudio";
import { feedAudio, probeAudioCodec, withEncoders } from "./webCodecsAudio";

// The platform half of the audio-file seam: the same offline render the video export
// sounds, encoded on its own.
//
// Everything here is already in the building. renderTakeAudio produces the take's audio,
// core/videoEncoding picks the codec the engine will take, and mediabunny writes the
// container — the video export is these three plus a picture. So an audio file is not a
// second renderer with its own idea of how a take sounds; it is the same take, minus the
// frames, and a person who exports both gets two files that agree.
//
// MP3 is not among the choices: no engine encodes it, and AAC is smaller at the same
// quality and no less playable. The writer could carry one from an encoder shipped with
// the app; that is a decision about weight, not a limit of the container.

// The take as an MP4 holding nothing but sound — an .m4a, which is what that is called.
async function encoded(audio: AudioBuffer, codec: AudioCodecChoice): Promise<Blob> {
    // A first chunk at a small non-zero time — some engines emit one — is shifted to zero
    // by the writer and noted in an edit list, as the video export relies on too.
    const output = new Output({
        format: new Mp4OutputFormat({ fastStart: "in-memory" }),
        target: new BufferTarget(),
    });
    const source = new EncodedAudioPacketSource(codec.container);
    output.addAudioTrack(source);

    let failure: Error | null = null;
    const fail = (error: Error) => {
        failure = failure ?? error;
    };
    // Packets go to the writer one at a time in the order the encoder emitted them.
    let queue: Promise<void> = Promise.resolve();
    const encoder = new AudioEncoder({
        output: (chunk, meta) => {
            queue = queue
                .then(() => source.add(EncodedPacket.fromEncodedChunk(chunk), meta))
                .catch(fail);
        },
        error: fail,
    });
    await output.start();
    await withEncoders([encoder], async () => {
        encoder.configure(audioConfig(codec.codec, audio));
        feedAudio(encoder, audio);
        if (failure) {
            throw failure;
        }
        await encoder.flush();
        await queue;
    });
    if (failure) {
        throw failure;
    }
    await output.finalize();
    const bytes = output.target.buffer;
    if (!bytes) {
        throw new Error("the writer finalised nothing");
    }
    return new Blob([bytes as BlobPart], { type: "audio/mp4" });
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
                // principle and refused in practice, or a writer that would not take the
                // packets. Falling through to WAV is better than failing an export that a
                // format needing no encoder at all can still satisfy.
            }
        }
        return {
            blob: new Blob([wavBytes(audio) as BlobPart], { type: "audio/wav" }),
            extension: "wav",
        };
    },
};
