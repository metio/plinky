// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { createNoteTracker, detectPitches, rms } from "../../core/pitch";
import type { PitchInput, PitchStartResult } from "../ports/pitchInput";
import type { Scheduler, SchedulerHandle } from "../ports/scheduler";

// The real microphone: getUserMedia into an AnalyserNode, a frame of samples
// per animation frame through the pure detector, and the tracker's settled
// events out. Raw audio on purpose — echo cancellation and noise suppression
// are tuned for speech and eat piano partials — and everything torn down on
// stop so the mic indicator never lingers.
//
// The sampling loop runs on the injected Scheduler rather than the raw frame
// callback, so a test can hand it a frame at a time and assert what the tracker
// emitted — the analyser and the detector are the only parts left needing a
// real browser.

// 2048 samples at 44.1/48 kHz ≈ 43–46 ms — enough periods of a low note to
// correlate, short enough that detection tracks live playing.
const FFT_SIZE = 2048;

// Why the mic never opened, in the two words the caller acts on. A refusal is
// the player's own choice and the UI asks again on the next attempt; everything
// else — no device, a device already held, a context that can't capture — is an
// error the UI reports. Only NotAllowedError means the player said no; a bare
// failure carries no such promise, so it degrades to "error".
export function classifyMicError(error: unknown): Extract<PitchStartResult, "denied" | "error"> {
    return error instanceof DOMException && error.name === "NotAllowedError" ? "denied" : "error";
}

export function micPitch(scheduler: Scheduler): PitchInput {
    let stream: MediaStream | null = null;
    let context: AudioContext | null = null;
    let frameHandle: SchedulerHandle | null = null;
    let onDone: (() => void) | null = null;
    // Bumped by every start(), so a start whose getUserMedia is still pending when a newer
    // start() supersedes it can tell — and release the microphone it just acquired instead
    // of overwriting the live listener's stream and orphaning the old track (mic left on)
    // and its frame loop. This is the async gap between requesting and owning the device.
    let generation = 0;

    const stop = () => {
        if (frameHandle !== null) {
            scheduler.cancelFrame(frameHandle);
            frameHandle = null;
        }
        onDone?.();
        onDone = null;
        for (const track of stream?.getTracks() ?? []) {
            track.stop();
        }
        stream = null;
        void context?.close().catch(() => {});
        context = null;
    };

    return {
        supported() {
            return (
                typeof navigator !== "undefined" &&
                typeof navigator.mediaDevices?.getUserMedia === "function"
            );
        },

        async start(onEvent, options): Promise<PitchStartResult> {
            stop();
            const myGeneration = ++generation;
            let acquired: MediaStream;
            try {
                acquired = await navigator.mediaDevices.getUserMedia({
                    audio: {
                        echoCancellation: false,
                        noiseSuppression: false,
                        autoGainControl: false,
                    },
                });
            } catch (error) {
                return classifyMicError(error);
            }

            // A newer start() ran while this one awaited the device. The stream we just got
            // belongs to nobody — stop its track here rather than adopt it over the newer
            // listener's stream. The newer start owns the shared state and is the live
            // listener, so the outcome for this (superseded) call is still "listening".
            if (myGeneration !== generation) {
                for (const track of acquired.getTracks()) {
                    track.stop();
                }
                return "listening";
            }

            try {
                // Older Safari only exposes the prefixed constructor; mirror the audio engine.
                // globalThis, not window — this adapter is also constructed under the node test
                // environment, which has a stubbed global but no window.
                const Ctor =
                    globalThis.AudioContext ??
                    (globalThis as unknown as { webkitAudioContext?: typeof AudioContext })
                        .webkitAudioContext;
                // Adopt the stream before anything can throw, so a failure below is torn
                // down by stop() rather than leaking the freshly-granted microphone track.
                stream = acquired;
                if (!Ctor) {
                    throw new Error("no AudioContext");
                }
                context = new Ctor();
                // A context born while autoplay is still gated starts suspended and the
                // analyser reads silence; nudge it running so the detector actually hears.
                void context.resume?.().catch(() => {});
                const source = context.createMediaStreamSource(stream);
                const analyser = context.createAnalyser();
                analyser.fftSize = FFT_SIZE;
                source.connect(analyser);

                const calibration = options?.calibration;
                const onSample = options?.onSample;
                const frame = new Float32Array(analyser.fftSize);
                const tracker = createNoteTracker({ calibration });
                // The mic keeps sounding a note when stop() lands mid-sustain;
                // flushing releases it so no key stays lit.
                onDone = () => {
                    for (const event of tracker.flush()) {
                        onEvent(event);
                    }
                };
                const sampleRate = context.sampleRate;
                const tick = () => {
                    analyser.getFloatTimeDomainData(frame);
                    const level = rms(frame);
                    const notes = detectPitches(frame, sampleRate, 3, calibration);
                    // The wizard reads raw loudness and pitch off the same graph
                    // the note events flow from — one signal chain, so a tuning
                    // measured here holds when the player actually plays.
                    onSample?.({ rms: level, notes });
                    for (const event of tracker.track(notes, level)) {
                        onEvent(event);
                    }
                    frameHandle = scheduler.frame(tick);
                };
                frameHandle = scheduler.frame(tick);
                return "listening";
            } catch {
                stop();
                return "error";
            }
        },

        stop,
    };
}
