// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { PedalKind } from "../../core/pedals";
import type { AudioEngine, ClickKind, NoteStrike } from "../ports/audioEngine";

// An AudioEngine for tests: strikes and clicks are recorded instead of played,
// so a test hands a component this fake through the services provider and
// asserts on what would have sounded — no Web Audio globals to stub.
export type FakeAudioEngine = AudioEngine & {
    strikes: NoteStrike[];
    // Live-voice events, in order, so a test can assert what was pressed, released and how
    // the pedal moved — the articulation the live play path drives.
    voices: Array<
        | { kind: "press"; note: number; gain: number }
        | { kind: "release"; note: number; holdScale: number }
    >;
    pedals: Array<{ pedal: PedalKind; down: boolean }>;
    clicks: Array<{ time: number; kind: ClickKind; gain: number }>;
    resumed: number;
    unlocked: number;
    // How many times the panic (allNotesOff) fired — a test asserts a play surface
    // silences everything on teardown.
    silenced: number;
    // The fake audio clock, advanced by the test.
    time: number;
};

export function fakeAudioEngine(): FakeAudioEngine {
    const engine: FakeAudioEngine = {
        strikes: [],
        voices: [],
        pedals: [],
        clicks: [],
        resumed: 0,
        unlocked: 0,
        silenced: 0,
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
        press(note, gain) {
            engine.voices.push({ kind: "press", note, gain });
        },
        release(note, holdScale = 1) {
            engine.voices.push({ kind: "release", note, holdScale });
        },
        setPedal(pedal, down) {
            engine.pedals.push({ pedal, down });
        },
        allNotesOff() {
            engine.silenced += 1;
        },
        click(time, kind, gain) {
            engine.clicks.push({ time, kind, gain });
        },
    };
    return engine;
}
