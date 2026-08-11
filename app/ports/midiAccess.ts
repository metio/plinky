// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Where MIDI comes from, and where it can go. A narrow seam over the Web MIDI API
// shaped by what the app actually consumes: whether the platform offers MIDI, the
// persisted permission (so a granted connection resumes without prompting), and —
// once access is granted — the inputs and their message streams, plus any outputs
// worth echoing to. The connection's state is the browser's; the port only reports
// it.

export type MidiInput = {
    id: string;
    name: string;
    manufacturer: string;
    state: "connected" | "disconnected";
    // Register the input's message handler (replacing any previous one): the raw
    // MIDI bytes plus the event's own timestamp, on the performance.now() scale.
    onMessage(handler: (data: Uint8Array, timestamp: number) => void): void;
};

// A device the app can send to — a keyboard that lights its keys, or a sound module.
export type MidiOutput = {
    id: string;
    name: string;
    // Send raw MIDI bytes now. Errors are the adapter's to swallow: a device
    // unplugged mid-send must never take down the run that was echoing to it.
    send(data: number[]): void;
};

export type MidiConnection = {
    inputs(): MidiInput[];
    // The devices that can be sent to. Empty when the platform grants access to
    // inputs only, which is the common case — sending is a bonus, never a
    // requirement, and nothing in the app may depend on an output existing.
    outputs(): MidiOutput[];
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
