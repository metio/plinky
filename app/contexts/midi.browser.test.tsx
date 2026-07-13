// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup } from "@testing-library/react";
import { fakeMidi, fakeMidiInput } from "../adapters/fakeMidi";
import { webMidi } from "../adapters/webMidi";
import { ServicesProvider } from "./services";
import { MidiProvider, useMidiConnection, useMidiInput } from "./midi";

// Real chromium, with the "midi" permission granted at the browser-context level
// (vitest.config.ts) — so the genuine Web MIDI adapter runs its full permission,
// request and resume paths, not a stub of them.

afterEach(cleanup);

// A probe that renders the connection state the tests assert on.
function Probe() {
    const { support, status, devices, heldNotes } = useMidiConnection();
    return (
        <div>
            <output aria-label="support">{support}</output>
            <output aria-label="status">{status}</output>
            <output aria-label="devices">{devices.map((device) => device.name).join(",")}</output>
            <output aria-label="held">{heldNotes.join(",")}</output>
        </div>
    );
}

// A probe that subscribes to pedal events the way the play surface does, so a raw
// CC64 message can be asserted end to end through the real context.
function PedalProbe() {
    const [pedal, setPedal] = useState("up");
    useMidiInput({ onPedal: (down) => setPedal(down ? "down" : "up") });
    return <output aria-label="pedal">{pedal}</output>;
}

describe("webMidi adapter in a real browser", () => {
    it("offers MIDI and reports the granted permission", async () => {
        expect(webMidi.supported()).toBe(true);
        expect(await webMidi.permissionState()).toBe("granted");
    });

    it("opens a real connection where the platform has a MIDI backend", async () => {
        // A containerized runner has no ALSA/MIDI subsystem, so Chromium may fail
        // its platform initialization even with permission granted. Both outcomes
        // are asserted: a resolved connection behaves, and a platform failure is
        // exactly that — never a permission denial, which the grant rules out.
        try {
            const connection = await webMidi.request();
            expect(Array.isArray(connection.inputs())).toBe(true);
            expect(() => connection.close()).not.toThrow();
        } catch (error) {
            expect(String(error)).not.toMatch(/not granted|NotAllowed/i);
        }
    });
});

describe("MidiProvider over the real adapter", () => {
    it("attempts the silent resume on mount — no prompt, no click", async () => {
        render(
            <MidiProvider>
                <Probe />
            </MidiProvider>,
        );
        expect(screen.getByLabelText("support").textContent).toBe("supported");
        // The granted permission makes the provider request access by itself; on a
        // machine with a MIDI backend that ends "ready", in a container the platform
        // initialization fails and ends "denied". Either way it must leave idle —
        // the resume fired without any user gesture.
        await waitFor(() =>
            expect(["ready", "denied"]).toContain(screen.getByLabelText("status").textContent),
        );
    });
});

describe("MidiProvider over the fake seam in a real browser", () => {
    it("runs the whole pipeline: connect, hot-plug, raw bytes to held notes", async () => {
        const input = fakeMidiInput({ name: "Stage Piano" });
        const midi = fakeMidi({ permission: "granted", inputs: [input] });
        render(
            <ServicesProvider services={{ midi }}>
                <MidiProvider>
                    <Probe />
                </MidiProvider>
            </ServicesProvider>,
        );
        // granted → the provider resumes by itself and wires the input.
        await waitFor(() => expect(screen.getByLabelText("status").textContent).toBe("ready"));
        expect(screen.getByLabelText("devices").textContent).toBe("Stage Piano");

        input.emit([0x90, 60, 100]); // note-on C4
        await waitFor(() => expect(screen.getByLabelText("held").textContent).toBe("60"));
        input.emit([0x90, 64, 90]); // chord up
        await waitFor(() => expect(screen.getByLabelText("held").textContent).toBe("60,64"));

        input.emit([0x90, 60, 0]); // running-status release: note-on at velocity 0
        input.emit([0x80, 64, 0]); // plain note-off
        await waitFor(() => expect(screen.getByLabelText("held").textContent).toBe(""));

        input.emit([0xb0, 7, 127]); // a volume control change is not a note — ignored
        input.emit([0x90, 62, 80]); // a real note after it still lands alone
        await waitFor(() => expect(screen.getByLabelText("held").textContent).toBe("62"));
    });

    it("routes the sustain pedal (CC64) through to pedal subscribers", async () => {
        const input = fakeMidiInput({ name: "Stage Piano" });
        const midi = fakeMidi({ permission: "granted", inputs: [input] });
        render(
            <ServicesProvider services={{ midi }}>
                <MidiProvider>
                    <PedalProbe />
                </MidiProvider>
            </ServicesProvider>,
        );
        await waitFor(() => expect(screen.getByLabelText("pedal").textContent).toBe("up"));

        input.emit([0xb0, 64, 127]); // sustain pedal pressed
        await waitFor(() => expect(screen.getByLabelText("pedal").textContent).toBe("down"));
        input.emit([0xb0, 64, 0]); // sustain pedal released
        await waitFor(() => expect(screen.getByLabelText("pedal").textContent).toBe("up"));
    });
});

describe("the __plinky bridge", () => {
    it("drives raw bytes through the parse pipeline and reads state back", async () => {
        render(
            <ServicesProvider services={{ midi: fakeMidi() }}>
                <MidiProvider>
                    <Probe />
                </MidiProvider>
            </ServicesProvider>,
        );
        const bridge = window.__plinky;
        expect(bridge).toBeDefined();

        bridge?.midiBytes([0x91, 72, 88]); // channel 2 note-on C5
        await waitFor(() => expect(bridge?.midiState().heldNotes).toEqual([72]));
        expect(screen.getByLabelText("held").textContent).toBe("72");

        bridge?.midiBytes([0x81, 72, 0]);
        await waitFor(() => expect(bridge?.midiState().heldNotes).toEqual([]));
    });
});
