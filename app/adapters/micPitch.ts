// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

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
    // Whether a listener is wanted at all. The generation counter alone cannot tell a stop
    // from a newer start, and the two want opposite answers from a request already in
    // flight: a newer start owns the device, a stop means nobody does.
    let wanted = false;

    const stop = () => {
        // Bumped so a request still awaiting the device knows it was called off. Without
        // it, stop() has nothing to tear down while getUserMedia is pending — stream,
        // context and frame handle are all still null — and the permission, once granted,
        // was adopted anyway: the microphone opened and the sampling loop started after
        // the player had said stop.
        wanted = false;
        generation += 1;
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
            wanted = true;
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

            // Something happened while this one awaited the device. Either way the stream
            // just granted belongs to nobody, so its track is stopped here rather than
            // adopted — the difference is only what to tell the caller. A newer start()
            // owns the shared state and is the live listener; a stop() means nobody is
            // listening, and reporting otherwise leaves the panel claiming a microphone
            // that has been released.
            if (myGeneration !== generation) {
                for (const track of acquired.getTracks()) {
                    track.stop();
                }
                return wanted ? "listening" : "idle";
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
