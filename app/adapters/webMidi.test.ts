// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { webMidi } from "./webMidi";

// The real Web MIDI adapter against a stubbed browser. What cannot be tested on
// real hardware here — a device that fails mid-send — is exactly what matters:
// echoing is decoration, and decoration must never be able to stop the music.

type StubOutput = { id: string; name?: string | null; send: (data: number[]) => void };

function stubAccess(outputs: StubOutput[]) {
    const access = {
        inputs: new Map(),
        outputs: new Map(outputs.map((output) => [output.id, output])),
        onstatechange: null,
    };
    vi.stubGlobal("navigator", {
        ...navigator,
        requestMIDIAccess: () => Promise.resolve(access),
    });
}

afterEach(() => vi.unstubAllGlobals());

describe("webMidi outputs", () => {
    it("hands back every output the browser offers", async () => {
        stubAccess([
            { id: "a", name: "Piano", send: () => {} },
            { id: "b", name: "Module", send: () => {} },
        ]);

        const outputs = (await webMidi.request()).outputs();

        expect(outputs.map((output) => output.name)).toEqual(["Piano", "Module"]);
        expect(outputs.map((output) => output.id)).toEqual(["a", "b"]);
    });

    it("names a device the browser could not", async () => {
        stubAccess([{ id: "a", name: null, send: () => {} }]);

        expect((await webMidi.request()).outputs()[0]?.name).toBe("Unknown device");
    });

    it("swallows a device that fails mid-send", async () => {
        // A keyboard unplugged between the lookup and the send throws. The run that
        // was echoing to it has to carry on regardless.
        stubAccess([
            {
                id: "a",
                name: "Gone",
                send: () => {
                    throw new Error("device disappeared");
                },
            },
        ]);

        const output = (await webMidi.request()).outputs()[0];

        expect(() => output?.send([0x90, 60, 100])).not.toThrow();
    });

    it("passes the bytes through untouched when the device is there", async () => {
        const seen: number[][] = [];
        stubAccess([{ id: "a", name: "Piano", send: (data) => seen.push(data) }]);

        (await webMidi.request()).outputs()[0]?.send([0x90, 60, 100]);

        expect(seen).toEqual([[0x90, 60, 100]]);
    });

    it("reports no outputs without complaint", async () => {
        stubAccess([]);

        expect((await webMidi.request()).outputs()).toEqual([]);
    });
});

// A port that was open, closed when the cable came out, and came back on replug. The
// difference between a keyboard that plays again by itself and one that stays silent
// until the player goes to Settings and reconnects by hand.
function stubAccessWithInput(input: Record<string, unknown>) {
    vi.stubGlobal("navigator", {
        ...navigator,
        requestMIDIAccess: () =>
            Promise.resolve({
                inputs: new Map([[input.id as string, input]]),
                outputs: new Map(),
                onstatechange: null,
            }),
    });
}

describe("webMidi inputs", () => {
    it("opens the port it attaches a listener to", async () => {
        const open = vi.fn(() => Promise.resolve());
        stubAccessWithInput({ id: "in-1", name: "Piano", open, onmidimessage: null });
        const connection = await webMidi.request();
        connection.inputs()[0]?.onMessage(() => {});
        expect(open).toHaveBeenCalled();
    });

    it("still delivers messages when the port refuses to open", async () => {
        const open = vi.fn(() => Promise.reject(new Error("gone")));
        const input: Record<string, unknown> = {
            id: "in-1",
            name: "Piano",
            open,
            onmidimessage: null,
        };
        stubAccessWithInput(input);
        const connection = await webMidi.request();
        const seen: number[][] = [];
        connection.inputs()[0]?.onMessage((data) => seen.push([...data]));
        (input.onmidimessage as (event: { data: Uint8Array }) => void)({
            data: new Uint8Array([0x90, 60, 100]),
        });
        expect(seen).toEqual([[0x90, 60, 100]]);
    });

    it("attaches to a browser whose ports cannot be opened at all", async () => {
        // open() is optional in the type and absent in older implementations.
        const input: Record<string, unknown> = { id: "in-1", name: "Piano", onmidimessage: null };
        stubAccessWithInput(input);
        const connection = await webMidi.request();
        expect(() => connection.inputs()[0]?.onMessage(() => {})).not.toThrow();
    });
});
