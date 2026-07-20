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
                    // Stamp on receipt with performance.now() rather than carrying
                    // event.timeStamp. The spec ties timeStamp to the page time origin,
                    // but real MIDI drivers don't reliably honour that — some stamp on a
                    // system/subsystem epoch or emit 0. Mixing that rogue origin with the
                    // performance-clock stamps the capture uses to CLOSE a note (the
                    // end-of-run flush, a blur/disconnect force-release) yields a hold
                    // length ≈ time-since-page-load: the first held note (or a note left
                    // ringing under the sustain pedal) records as sustained for the whole
                    // uptime. Stamping every message on the one clock the flush also reads
                    // keeps open and close on the same origin.
                    handler(event.data, performance.now());
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
