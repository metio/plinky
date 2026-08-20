// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Enough of a Web Audio context for the engine to build its graphs against, and — the
// point of it — a record of which oscillators were started and which were ever stopped.
//
// A voice that is started and never stopped is this project's recurring audio defect: the
// synthesised path schedules no stop of its own, so anything dropped from a held set
// without being ended rings until something unrelated silences it. That is invisible to a
// smoke test, which only asks whether the graph built without throwing, so it needs a
// context that remembers.

export type FakeOscillator = { started: boolean; stopped: boolean };

export type FakeAudioContext = {
    context: AudioContext;
    // Oscillators started and never stopped — a voice still sounding.
    live(): number;
    started(): number;
};

export function fakeAudioContext(): FakeAudioContext {
    const oscillators: FakeOscillator[] = [];
    const now = 0;

    const param = () => ({
        value: 0,
        setValueAtTime: () => param(),
        exponentialRampToValueAtTime: () => param(),
        linearRampToValueAtTime: () => param(),
        cancelScheduledValues: () => param(),
        setTargetAtTime: () => param(),
    });
    const node = () => ({ connect: () => node(), disconnect: () => {}, gain: param() });

    const context = {
        get currentTime() {
            return now;
        },
        sampleRate: 48_000,
        destination: node(),
        resume: () => Promise.resolve(),
        close: () => Promise.resolve(),
        createGain: () => ({ ...node(), gain: param() }),
        createBiquadFilter: () => ({ ...node(), frequency: param(), Q: param(), type: "lowpass" }),
        createDynamicsCompressor: () => ({
            ...node(),
            threshold: param(),
            knee: param(),
            ratio: param(),
            attack: param(),
            release: param(),
        }),
        createBuffer: (channels: number, length: number) => ({
            duration: length / 48_000,
            length,
            numberOfChannels: channels,
            getChannelData: () => new Float32Array(length),
        }),
        createBufferSource: () => {
            const source = { started: false, stopped: false };
            oscillators.push(source);
            return {
                ...node(),
                buffer: null,
                playbackRate: param(),
                start: () => {
                    source.started = true;
                },
                stop: () => {
                    source.stopped = true;
                },
            };
        },
        createOscillator: () => {
            const osc = { started: false, stopped: false };
            oscillators.push(osc);
            return {
                ...node(),
                type: "sine",
                frequency: param(),
                detune: param(),
                start: () => {
                    osc.started = true;
                },
                stop: () => {
                    osc.stopped = true;
                },
            };
        },
    } as unknown as AudioContext;

    return {
        context,
        live: () => oscillators.filter((one) => one.started && !one.stopped).length,
        started: () => oscillators.filter((one) => one.started).length,
    };
}
