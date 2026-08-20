// @vitest-environment jsdom
// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it, vi } from "vitest";
import { fakeScheduler } from "../testing/fakeScheduler";
import { classifyMicError, micPitch } from "./micPitch";

describe("classifyMicError", () => {
    it("reads a refused permission prompt as denied", () => {
        expect(classifyMicError(new DOMException("Permission denied", "NotAllowedError"))).toBe(
            "denied",
        );
    });

    it("reads every other getUserMedia failure as an error", () => {
        expect(
            classifyMicError(new DOMException("Requested device not found", "NotFoundError")),
        ).toBe("error");
        expect(classifyMicError(new DOMException("Device in use", "NotReadableError"))).toBe(
            "error",
        );
    });

    it("reads a non-DOMException rejection as an error", () => {
        expect(classifyMicError(new Error("NotAllowedError"))).toBe("error");
        expect(classifyMicError("NotAllowedError")).toBe("error");
        expect(classifyMicError(undefined)).toBe("error");
    });
});

describe("micPitch", () => {
    it("reports unsupported where the browser exposes no capture device", () => {
        expect(micPitch(fakeScheduler()).supported()).toBe(false);
    });

    // stop() before start() is the teardown a component runs on unmount whether
    // or not the mic ever opened.
    it("stops idempotently without ever having started", () => {
        const input = micPitch(fakeScheduler());

        expect(() => {
            input.stop();
            input.stop();
        }).not.toThrow();
    });

    it("leaves no frame pending when a mic that never opened is stopped", () => {
        const scheduler = fakeScheduler();
        micPitch(scheduler).stop();

        expect(scheduler.pending().frames).toBe(0);
    });
});

// A microphone jsdom does not have: getUserMedia hands back a stream whose
// tracks record their own stop(), and the analyser fills each frame with a
// steady tone. Enough of the platform to run the sampling loop for real —
// only the capture and the FFT are stand-ins; the detector and the tracker
// are the shipped ones.
function stubMic(hz: number, sampleRate = 48_000) {
    const track = { stop: vi.fn() };
    const stream = { getTracks: () => [track] };
    const closed = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", {
        mediaDevices: { getUserMedia: vi.fn().mockResolvedValue(stream) },
    });
    vi.stubGlobal(
        "AudioContext",
        class {
            sampleRate = sampleRate;
            close = closed;
            createMediaStreamSource() {
                return { connect: () => {} };
            }
            createAnalyser() {
                return {
                    fftSize: 0,
                    connect: () => {},
                    getFloatTimeDomainData(frame: Float32Array) {
                        for (let i = 0; i < frame.length; i++) {
                            frame[i] = Math.sin((2 * Math.PI * hz * i) / sampleRate) * 0.5;
                        }
                    },
                };
            }
        },
    );
    return { track, closed };
}

describe("micPitch's sampling loop", () => {
    it("samples once per frame the scheduler grants, and keeps asking for the next", async () => {
        const scheduler = fakeScheduler();
        const samples: number[] = [];
        const input = micPitch(scheduler);

        stubMic(440);
        await input.start(() => {}, { onSample: ({ rms }) => samples.push(rms) });

        // One frame is queued and nothing has been read until it runs.
        expect(scheduler.pending().frames).toBe(1);
        expect(samples).toHaveLength(0);

        scheduler.runFrames();
        expect(samples).toHaveLength(1);
        // A tone at half amplitude: the loop read the analyser, not silence.
        expect(samples[0]).toBeGreaterThan(0.1);
        // The tick queued the next frame rather than ending the loop.
        expect(scheduler.pending().frames).toBe(1);

        scheduler.runFrames();
        expect(samples).toHaveLength(2);

        input.stop();
    });

    it("releases the mic and its frame on stop, so no indicator lingers", async () => {
        const scheduler = fakeScheduler();
        const input = micPitch(scheduler);
        const { track, closed } = stubMic(440);

        await input.start(() => {});
        scheduler.runFrames();
        input.stop();

        expect(scheduler.pending().frames).toBe(0);
        expect(track.stop).toHaveBeenCalled();
        expect(closed).toHaveBeenCalled();
    });

    it("hands the player's refusal back as denied, leaving nothing scheduled", async () => {
        const scheduler = fakeScheduler();
        vi.stubGlobal("navigator", {
            mediaDevices: {
                getUserMedia: vi
                    .fn()
                    .mockRejectedValue(new DOMException("Permission denied", "NotAllowedError")),
            },
        });

        expect(await micPitch(scheduler).start(() => {})).toBe("denied");
        expect(scheduler.pending().frames).toBe(0);
    });
});

describe("a start called off before the device arrives", () => {
    // The player closes the panel, or navigates away, while the browser is still asking.
    // stop() has nothing to tear down at that moment — stream, context and frame handle
    // are all still null — so without a signal to the pending request the permission,
    // once granted, was adopted anyway: microphone open and sampling running after they
    // had said stop.
    // Every request gets its own pending promise and its own track, so a test that starts
    // twice can settle both — capturing only the latest resolver leaves the first request
    // hanging forever, which reads as a timeout rather than as the bug under test.
    const pendingPermission = () => {
        const waiting: ((stream: MediaStream) => void)[] = [];
        const tracks: MediaStreamTrack[] = [];
        const getUserMedia = vi.fn(
            () =>
                new Promise<MediaStream>((resolve) => {
                    waiting.push(resolve);
                }),
        );
        vi.stubGlobal("navigator", { mediaDevices: { getUserMedia } });
        const grant = () => {
            for (const resolve of waiting.splice(0)) {
                const track = { stop: vi.fn(), kind: "audio" } as unknown as MediaStreamTrack;
                tracks.push(track);
                resolve({ getTracks: () => [track] } as unknown as MediaStream);
            }
        };
        return { grant, trackAt: (index: number) => tracks[index]! };
    };

    it("releases the microphone instead of adopting it", async () => {
        // The adopt path has to be able to SUCCEED for this to mean anything: without an
        // AudioContext it throws, the error handler calls stop(), and the track is
        // released for a reason that has nothing to do with the fix. This test passed
        // against the unfixed adapter until the stub below was added.
        vi.stubGlobal(
            "AudioContext",
            class {
                sampleRate = 48_000;
                resume = () => Promise.resolve();
                close = () => Promise.resolve();
                createMediaStreamSource = () => ({ connect: () => {} });
                createAnalyser = () => ({
                    fftSize: 2048,
                    getFloatTimeDomainData: () => {},
                    connect: () => {},
                });
            },
        );
        const { grant, trackAt } = pendingPermission();
        const pitch = micPitch(fakeScheduler());
        const started = pitch.start(() => {});
        pitch.stop();
        grant();
        await started;
        expect(trackAt(0).stop).toHaveBeenCalled();
    });

    it("says it is idle, not that it is listening", async () => {
        const { grant } = pendingPermission();
        const pitch = micPitch(fakeScheduler());
        const started = pitch.start(() => {});
        pitch.stop();
        grant();
        // The panel reads this straight into its status; "listening" would leave it
        // claiming a microphone that has been released.
        expect(await started).toBe("idle");
    });

    it("still says listening when a newer start took over", async () => {
        // A supersede is the other reason a pending request finds itself unwanted, and it
        // wants the opposite answer: somebody IS listening, just not this call.
        const { grant, trackAt } = pendingPermission();
        const pitch = micPitch(fakeScheduler());
        const first = pitch.start(() => {});
        const second = pitch.start(() => {});
        grant();
        expect(await first).toBe("listening");
        await second;
        expect(trackAt(0).stop).toHaveBeenCalled();
    });
});
