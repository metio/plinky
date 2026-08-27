// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it, vi } from "vitest";
import { wrapInput } from "./webMidi";

// Every note the app hears from a real instrument passes through wrapInput, and no test
// reached it: the browser-midi project injects a fake before this point, and the fake
// disagrees with the real thing about the one decision made here — which clock stamps a
// message. A real MIDIInput cannot be conjured without hardware, so what is pinned is
// our own mapping, driven by an input shaped like the browser's.

type FakePort = {
    id: string;
    name: string | null;
    manufacturer: string | null;
    state: MIDIPortDeviceState;
    open: ReturnType<typeof vi.fn>;
    onmidimessage: ((event: MIDIMessageEvent) => void) | null;
};

function fakePort(over: Partial<FakePort> = {}): FakePort {
    return {
        id: "in-1",
        name: "Yamaha P-125",
        manufacturer: "Yamaha",
        state: "connected",
        open: vi.fn(async () => undefined),
        onmidimessage: null,
        ...over,
    };
}

// wrapInput wants the browser's type; the fake is shaped like one.
const asInput = (port: FakePort) => port as unknown as MIDIInput;

// The spec ties timeStamp to the page time origin; real drivers often ignore that.
const ROGUE = 987_654_321;

function send(port: FakePort, data: Uint8Array | null) {
    port.onmidimessage?.({ data, timeStamp: ROGUE } as unknown as MIDIMessageEvent);
}

describe("wrapInput", () => {
    it("carries the device's identity across", () => {
        const wrapped = wrapInput(asInput(fakePort()));

        expect(wrapped.id).toBe("in-1");
        expect(wrapped.name).toBe("Yamaha P-125");
        expect(wrapped.manufacturer).toBe("Yamaha");
        expect(wrapped.state).toBe("connected");
    });

    it("names a device that will not say what it is", () => {
        const wrapped = wrapInput(asInput(fakePort({ name: null, manufacturer: null })));

        expect(wrapped.name).toBe("Unknown device");
        expect(wrapped.manufacturer).toBe("");
    });

    it("opens the port when a listener attaches", () => {
        // A port that closed under us on unplug does not reliably reopen on its own, and
        // the difference is a keyboard that works again on replug versus one that stays
        // silent until the player reconnects by hand in Settings.
        const port = fakePort();

        wrapInput(asInput(port)).onMessage(() => {});

        expect(port.open).toHaveBeenCalledTimes(1);
    });

    it("keeps listening when the port refuses to open", () => {
        const port = fakePort({ open: vi.fn(async () => Promise.reject(new Error("in use"))) });
        const heard: number[] = [];

        wrapInput(asInput(port)).onMessage((data) => heard.push(data[1] ?? -1));
        send(port, new Uint8Array([0x90, 60, 100]));

        expect(heard).toEqual([60]);
    });

    it("forwards the bytes untouched", () => {
        const port = fakePort();
        const heard: Uint8Array[] = [];

        wrapInput(asInput(port)).onMessage((data) => heard.push(data));
        send(port, new Uint8Array([0x90, 60, 100]));
        send(port, new Uint8Array([0xb0, 64, 127]));

        expect([...(heard[0] ?? [])]).toEqual([0x90, 60, 100]);
        expect([...(heard[1] ?? [])]).toEqual([0xb0, 64, 127]);
    });

    it("stamps on receipt rather than carrying the driver's own clock", () => {
        // The decision this function exists to make. A rogue origin mixed with the
        // performance-clock stamps that CLOSE a note yields a hold length of roughly
        // time-since-page-load: the first held note records as sustained for the whole
        // uptime.
        const port = fakePort();
        const stamps: number[] = [];

        wrapInput(asInput(port)).onMessage((_data, at) => stamps.push(at));
        send(port, new Uint8Array([0x90, 60, 100]));

        expect(stamps).toHaveLength(1);
        expect(stamps[0]).not.toBe(ROGUE);
        expect(Number.isFinite(stamps[0])).toBe(true);
        expect(stamps[0]).toBeGreaterThanOrEqual(0);
    });

    it("drops a message that carries no payload", () => {
        const port = fakePort();
        const heard: Uint8Array[] = [];

        wrapInput(asInput(port)).onMessage((data) => heard.push(data));
        send(port, null);

        expect(heard).toEqual([]);
    });

    it("replaces the handler rather than stacking listeners on a reconnect", () => {
        // Settings reconnects by attaching again; two live handlers would double every
        // note the player plays.
        const port = fakePort();
        const first: number[] = [];
        const second: number[] = [];
        const wrapped = wrapInput(asInput(port));

        wrapped.onMessage((data) => first.push(data[1] ?? -1));
        wrapped.onMessage((data) => second.push(data[1] ?? -1));
        send(port, new Uint8Array([0x90, 62, 100]));

        expect(first).toEqual([]);
        expect(second).toEqual([62]);
    });
});
