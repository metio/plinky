// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type {
    MidiAccessPort,
    MidiConnection,
    MidiInput,
    MidiPermission,
} from "../ports/midiAccess";

// A controllable MIDI seam for tests: hand it to the provider instead of the
// Web MIDI adapter and a test scripts devices, messages, denials and hot-plugs
// with no navigator stubbing.

export type FakeMidiInput = MidiInput & {
    // Deliver raw MIDI bytes to whatever handler the app registered.
    emit(data: number[], timestamp?: number): void;
    // Drop the registered handler, the way the real adapter's close() detaches
    // onmidimessage — an emit after severing reaches nobody.
    sever(): void;
    // Flip the input's reported state in place, keeping its id — the way a real device
    // going to sleep or being unplugged flips to "disconnected" without leaving the list.
    // Pair with connection.stateChange() to drive the provider's disconnect detection.
    setState(state: MidiInput["state"]): void;
};

export function fakeMidiInput(
    overrides: Partial<Omit<MidiInput, "onMessage">> = {},
): FakeMidiInput {
    let handler: ((data: Uint8Array, timestamp: number) => void) | null = null;
    let state = overrides.state ?? "connected";
    return {
        id: overrides.id ?? "fake-1",
        name: overrides.name ?? "Fake Piano",
        manufacturer: overrides.manufacturer ?? "Test",
        get state() {
            return state;
        },
        onMessage(next) {
            handler = next;
        },
        // The caller's timestamp is passed straight through, which the real adapter
        // deliberately does not do — it discards the driver's clock and stamps on receipt
        // with performance.now() (see webMidi.wrapInput, and the test that pins it). The
        // divergence is on purpose: a test needs to say when a note happened. It does
        // mean a timing assertion written against this fake proves nothing about the
        // clock a real instrument is read on.
        emit(data, timestamp = 0) {
            handler?.(new Uint8Array(data), timestamp);
        },
        sever() {
            handler = null;
        },
        setState(next) {
            state = next;
        },
    };
}

export type FakeMidi = MidiAccessPort & {
    connection: MidiConnection & {
        // Simulate a device being plugged or unplugged.
        stateChange(): void;
        closed(): boolean;
    };
    // Every MIDI message the app sent to an output, in order.
    sent(): number[][];
};

export function fakeMidi(
    options: {
        supported?: boolean;
        permission?: MidiPermission;
        // A rejection message makes request() fail, like a user denying the prompt.
        rejectWith?: string;
        inputs?: FakeMidiInput[];
        // Named outputs the fake offers. A test that cares what was sent reads
        // `sent` below; most tests want none, which is also the common real case.
        outputs?: string[];
    } = {},
): FakeMidi {
    const inputs = options.inputs ?? [];
    // Everything the app echoed, newest last — the assertion surface for a test
    // about sending rather than receiving.
    const sent: number[][] = [];
    const outputs = (options.outputs ?? []).map((name, index) => ({
        id: `out-${index}`,
        name,
        send: (data: number[]) => {
            sent.push(data);
        },
    }));
    let onStateChange: (() => void) | null = null;
    let closed = false;
    const connection = {
        inputs: () => inputs,
        outputs: () => outputs,
        onStateChange(handler: () => void) {
            onStateChange = handler;
        },
        close() {
            closed = true;
            onStateChange = null;
            // Mirror the real adapter: closing detaches every input handler, so
            // a test catches code that keeps processing after teardown.
            for (const input of inputs) {
                input.sever();
            }
        },
        stateChange() {
            onStateChange?.();
        },
        closed: () => closed,
    };
    return {
        supported: () => options.supported ?? true,
        request: () =>
            options.rejectWith
                ? Promise.reject(new Error(options.rejectWith))
                : Promise.resolve(connection),
        permissionState: () => Promise.resolve(options.permission ?? "prompt"),
        connection,
        sent: () => sent,
    };
}
