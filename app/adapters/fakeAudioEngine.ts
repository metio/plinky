// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { AudioEngine, ClickKind, NoteStrike } from "../ports/audioEngine";

// An AudioEngine for tests: strikes and clicks are recorded instead of played,
// so a test hands a component this fake through the services provider and
// asserts on what would have sounded — no Web Audio globals to stub.
export type FakeAudioEngine = AudioEngine & {
    strikes: NoteStrike[];
    clicks: Array<{ time: number; kind: ClickKind; gain: number }>;
    resumed: number;
    unlocked: number;
    // The fake audio clock, advanced by the test.
    time: number;
};

export function fakeAudioEngine(): FakeAudioEngine {
    const engine: FakeAudioEngine = {
        strikes: [],
        clicks: [],
        resumed: 0,
        unlocked: 0,
        time: 0,
        now() {
            return engine.time;
        },
        resume() {
            engine.resumed += 1;
        },
        unlock() {
            engine.unlocked += 1;
        },
        strike(strike) {
            engine.strikes.push(strike);
        },
        click(time, kind, gain) {
            engine.clicks.push({ time, kind, gain });
        },
    };
    return engine;
}
