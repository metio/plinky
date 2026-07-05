// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { MidiAccessPort, MidiConnection, MidiInput } from "../ports/midiAccess";

// The Web MIDI implementation of the MIDI seam — the one place the app touches
// navigator.requestMIDIAccess and the "midi" permission descriptor.

function wrapInput(input: MIDIInput): MidiInput {
    return {
        id: input.id,
        name: input.name ?? "Unknown device",
        manufacturer: input.manufacturer ?? "",
        state: input.state,
        onMessage(handler) {
            input.onmidimessage = (event) => {
                // A message without payload carries nothing to parse.
                if (event.data) {
                    handler(event.data, event.timeStamp);
                }
            };
        },
    };
}

function wrapAccess(access: MIDIAccess): MidiConnection {
    return {
        inputs: () => [...access.inputs.values()].map(wrapInput),
        onStateChange(handler) {
            access.onstatechange = () => handler();
        },
        close() {
            access.onstatechange = null;
            for (const input of access.inputs.values()) {
                input.onmidimessage = null;
            }
        },
    };
}

export const webMidi: MidiAccessPort = {
    supported: () =>
        typeof navigator !== "undefined" && typeof navigator.requestMIDIAccess === "function",
    async request() {
        if (!webMidi.supported()) {
            throw new Error("Web MIDI API is not available in this browser.");
        }
        return wrapAccess(await navigator.requestMIDIAccess({ sysex: false }));
    },
    async permissionState() {
        if (typeof navigator === "undefined" || !navigator.permissions) {
            return "unknown";
        }
        try {
            const permission = await navigator.permissions.query({
                name: "midi" as PermissionName,
            });
            return permission.state;
        } catch {
            // No "midi" descriptor (Safari, Firefox).
            return "unknown";
        }
    },
};
