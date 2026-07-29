// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
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
