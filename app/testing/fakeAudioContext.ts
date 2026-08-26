// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Enough of a Web Audio context for the engine to build its graphs against, and — the
// point of it — a record of which oscillators were started and when each was told to stop.
//
// A voice that is started and never stopped is this project's recurring audio defect: a
// path that schedules no stop of its own rings until something unrelated silences it. That
// is invisible to a smoke test, which only asks whether the graph built without throwing,
// so it needs a context that remembers.
//
// Never-stopped is not the whole question, though, which is why the stop TIME is kept.
// Every held voice now schedules its own far-off end, so "was it ever stopped" no longer
// separates a note ringing under the pedal from one that has been let go — both were
// stopped, one in a fifth of a second and one in sixteen. Ask ringingAt for that.

export type FakeOscillator = { started: boolean; stopped: boolean; stopAt: number | null };

export type FakeAudioContext = {
    context: AudioContext;
    // Oscillators started and never stopped at all — a voice nothing will ever end.
    live(): number;
    // Oscillators still sounding at `seconds` on the context clock: started, and either
    // never stopped or stopped after that moment. This is how a test asks whether a note is
    // still ringing at some point in the future rather than merely whether it is doomed.
    ringingAt(seconds: number): number;
    started(): number;
    // Which channels of the room's impulse response were written. Both, or the room has no
    // width; none, and nothing was ever routed through it.
    impulseChannels(): number[];
    // Whether audio leaving a node of this kind can arrive at the room, following the graph
    // however far it goes. A voice must; a metronome click must not.
    reachesConvolver(label: string): boolean;
    // How many recordings were played — struck notes and extras alike. Zero means nothing
    // came from the pack, whatever else sounded.
    recordingsPlayed(): number;
};

// Whether `from` reaches `to` through the recorded edges. Breadth-first over labels, with a
// seen-set: the graph has a cycle by construction, since the room's output and its wet
// return both land on the limiter.
function reaches(edges: readonly [string, string][], from: string, to: string): boolean {
    const seen = new Set<string>();
    const queue = [from];
    while (queue.length > 0) {
        const at = queue.shift() as string;
        if (at === to) {
            return true;
        }
        if (seen.has(at)) {
            continue;
        }
        seen.add(at);
        for (const [source, target] of edges) {
            if (source === at) {
                queue.push(target);
            }
        }
    }
    return false;
}

export function fakeAudioContext(): FakeAudioContext {
    const oscillators: FakeOscillator[] = [];
    const impulseChannels = new Set<number>();
    // Buffer sources alone — a recording being played, as opposed to a note synthesised
    // from oscillators. What separates "the pack answered" from "the synth covered for it".
    const recordings: FakeOscillator[] = [];
    const now = 0;

    const param = () => ({
        value: 0,
        setValueAtTime: () => param(),
        exponentialRampToValueAtTime: () => param(),
        linearRampToValueAtTime: () => param(),
        cancelScheduledValues: () => param(),
        setTargetAtTime: () => param(),
    });
    // Every node carries a label, and connecting records the pair, so a test can ask what
    // reaches the room and what goes straight to the speakers. Routing is the one thing
    // about the graph that a smoke test cannot see and that silently matters: a metronome
    // click routed through the reverb still plays, and still ruins the beat.
    const edges: [string, string][] = [];
    const node = (label = "node") => {
        const self = {
            label,
            connect: (to: { label?: string }) => {
                edges.push([label, to?.label ?? "?"]);
                return self;
            },
            disconnect: () => {},
            gain: param(),
        };
        return self;
    };

    const context = {
        get currentTime() {
            return now;
        },
        sampleRate: 48_000,
        destination: node("destination"),
        resume: () => Promise.resolve(),
        close: () => Promise.resolve(),
        createGain: () => ({ ...node("gain"), gain: param() }),
        createBiquadFilter: () => ({
            ...node("filter"),
            frequency: param(),
            Q: param(),
            type: "lowpass",
        }),
        createDynamicsCompressor: () => ({
            ...node("limiter"),
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
            // The room writes its impulse in a channel at a time. Recorded rather than
            // stored: what a test can usefully ask is that both ears were filled, since the
            // response itself is core's business and tested there.
            copyToChannel: (_data: Float32Array, channel: number) => {
                impulseChannels.add(channel);
            },
        }),
        // The room. Its response is convolved into the wet path; the node itself only has
        // to accept a buffer and pass audio on.
        createConvolver: () => ({ ...node("convolver"), buffer: null, normalize: true }),
        createBufferSource: () => {
            const source: FakeOscillator = { started: false, stopped: false, stopAt: null };
            oscillators.push(source);
            recordings.push(source);
            return {
                ...node("source"),
                buffer: null,
                playbackRate: param(),
                // The engine listens for "ended" to reap a strike that has finished
                // ringing. Nothing ever ends here, which is the point: an oscillator this
                // fake still counts as live is a voice the engine never stopped.
                addEventListener: () => {},
                removeEventListener: () => {},
                start: () => {
                    source.started = true;
                },
                // The last call wins, as it does in the real thing: a release scheduling an
                // earlier end over the voice's own far-off one is exactly that case.
                stop: (when?: number) => {
                    source.stopped = true;
                    source.stopAt = when ?? 0;
                },
            };
        },
        createOscillator: () => {
            const osc: FakeOscillator = { started: false, stopped: false, stopAt: null };
            oscillators.push(osc);
            return {
                ...node("oscillator"),
                type: "sine",
                frequency: param(),
                detune: param(),
                addEventListener: () => {},
                removeEventListener: () => {},
                start: () => {
                    osc.started = true;
                },
                stop: (when?: number) => {
                    osc.stopped = true;
                    osc.stopAt = when ?? 0;
                },
            };
        },
    } as unknown as AudioContext;

    return {
        context,
        live: () => oscillators.filter((one) => one.started && !one.stopped).length,
        ringingAt: (seconds) =>
            oscillators.filter(
                (one) => one.started && (one.stopAt === null || one.stopAt > seconds),
            ).length,
        started: () => oscillators.filter((one) => one.started).length,
        impulseChannels: () => [...impulseChannels].sort((one, other) => one - other),
        reachesConvolver: (label: string) => reaches(edges, label, "convolver"),
        recordingsPlayed: () => recordings.filter((one) => one.started).length,
    };
}
