// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

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
};

export function fakeMidiInput(
    overrides: Partial<Omit<MidiInput, "onMessage">> = {},
): FakeMidiInput {
    let handler: ((data: Uint8Array, timestamp: number) => void) | null = null;
    return {
        id: "fake-1",
        name: "Fake Piano",
        manufacturer: "Test",
        state: "connected" as const,
        ...overrides,
        onMessage(next) {
            handler = next;
        },
        emit(data, timestamp = 0) {
            handler?.(new Uint8Array(data), timestamp);
        },
        sever() {
            handler = null;
        },
    };
}

export type FakeMidi = MidiAccessPort & {
    connection: MidiConnection & {
        // Simulate a device being plugged or unplugged.
        stateChange(): void;
        closed(): boolean;
    };
};

export function fakeMidi(
    options: {
        supported?: boolean;
        permission?: MidiPermission;
        // A rejection message makes request() fail, like a user denying the prompt.
        rejectWith?: string;
        inputs?: FakeMidiInput[];
    } = {},
): FakeMidi {
    const inputs = options.inputs ?? [];
    let onStateChange: (() => void) | null = null;
    let closed = false;
    const connection = {
        inputs: () => inputs,
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
    };
}
