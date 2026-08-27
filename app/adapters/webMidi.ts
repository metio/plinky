// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { MidiAccessPort, MidiConnection, MidiInput, MidiOutput } from "../ports/midiAccess";

// The Web MIDI implementation of the MIDI seam — the one place the app touches
// navigator.requestMIDIAccess and the "midi" permission descriptor.

// Exported for its own test. Every note the app ever hears from a real instrument comes
// through this function, and until it was reachable the tests exercised a fake that
// disagreed with it about the one thing that matters here — which clock stamps a message.
export function wrapInput(input: MIDIInput): MidiInput {
    return {
        id: input.id,
        name: input.name ?? "Unknown device",
        manufacturer: input.manufacturer ?? "",
        state: input.state,
        onMessage(handler) {
            // Unplugging a cable closes the port; plugging it back in leaves it closed
            // until something opens it. Attaching a listener is specified to open it
            // implicitly, but a port that was open, closed under us and came back does not
            // reliably reopen on its own — which is the difference between a keyboard that
            // works again on replug and one that stays silent until the player goes to
            // Settings and reconnects by hand. Asking explicitly costs nothing on a port
            // that is already open.
            input.open?.().catch(() => {
                // A port that refuses to open is one the state change will report
                // disconnected anyway; playing carries on with whatever else is plugged in.
            });
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

function wrapOutput(output: MIDIOutput): MidiOutput {
    return {
        id: output.id,
        name: output.name ?? "Unknown device",
        send(data) {
            try {
                output.send(data);
            } catch {
                // A device unplugged between the lookup and the send throws; the run
                // that was echoing to it carries on regardless. Echoing is decoration,
                // and decoration must never be able to stop the music.
            }
        },
    };
}

function wrapAccess(access: MIDIAccess): MidiConnection {
    return {
        inputs: () => [...access.inputs.values()].map(wrapInput),
        outputs: () => [...access.outputs.values()].map(wrapOutput),
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
