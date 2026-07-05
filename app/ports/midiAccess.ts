// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// Where MIDI comes from. A narrow seam over the Web MIDI API shaped by what the
// app actually consumes: whether the platform offers MIDI, the persisted
// permission (so a granted connection resumes without prompting), and — once
// access is granted — the inputs and their message streams. The connection's
// state is the browser's; the port only reports it.

export type MidiInput = {
    id: string;
    name: string;
    manufacturer: string;
    state: "connected" | "disconnected";
    // Register the input's message handler (replacing any previous one): the raw
    // MIDI bytes plus the event's own timestamp, on the performance.now() scale.
    onMessage(handler: (data: Uint8Array, timestamp: number) => void): void;
};

export type MidiConnection = {
    inputs(): MidiInput[];
    // Register the handler called when a device is plugged or unplugged
    // (replacing any previous one).
    onStateChange(handler: () => void): void;
    // Unhook every handler; the connection is done being listened to.
    close(): void;
};

export type MidiPermission = "granted" | "denied" | "prompt" | "unknown";

export type MidiAccessPort = {
    // Whether this platform can offer MIDI at all.
    supported(): boolean;
    // Prompt for (or silently resume) access; rejects when denied or unavailable.
    request(): Promise<MidiConnection>;
    // The persisted permission without prompting; "unknown" when the platform
    // cannot say (no Permissions API, or no "midi" descriptor).
    permissionState(): Promise<MidiPermission>;
};
