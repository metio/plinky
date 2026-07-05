// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { webMidi } from "./webMidi";

// The adapter's wrapping is exercised against a scripted MIDIAccess shape —
// the real browser paths run in midi.browser.test.tsx where the platform
// cooperates; the wrapping logic itself must not depend on that.

type StubInput = {
    id: string;
    name?: string | null;
    manufacturer?: string | null;
    state: string;
    onmidimessage: ((event: { data: Uint8Array | null; timeStamp: number }) => void) | null;
};

function stubAccess(inputs: StubInput[]) {
    return {
        inputs: new Map(inputs.map((input) => [input.id, input])),
        onstatechange: null as (() => void) | null,
    };
}

function withAccess(access: ReturnType<typeof stubAccess>) {
    (navigator as unknown as { requestMIDIAccess: unknown }).requestMIDIAccess = vi.fn(() =>
        Promise.resolve(access),
    );
}

afterEach(() => {
    (navigator as unknown as { requestMIDIAccess?: unknown }).requestMIDIAccess = undefined;
});

describe("webMidi", () => {
    it("is unsupported without the API and supported with it", () => {
        expect(webMidi.supported()).toBe(false);
        withAccess(stubAccess([]));
        expect(webMidi.supported()).toBe(true);
    });

    it("rejects the request when the API is missing", async () => {
        await expect(webMidi.request()).rejects.toThrow(/not available/);
    });

    it("wraps inputs with name fallbacks and delivers messages with their timestamp", async () => {
        const raw: StubInput = {
            id: "in-1",
            name: null,
            manufacturer: null,
            state: "connected",
            onmidimessage: null,
        };
        withAccess(stubAccess([raw]));
        const connection = await webMidi.request();
        const [input] = connection.inputs();
        expect(input?.name).toBe("Unknown device");
        expect(input?.manufacturer).toBe("");

        const received: Array<[number[], number]> = [];
        input?.onMessage((data, timestamp) => received.push([[...data], timestamp]));
        raw.onmidimessage?.({ data: new Uint8Array([0x90, 60, 100]), timeStamp: 123 });
        expect(received).toEqual([[[0x90, 60, 100], 123]]);

        // A payload-less event carries nothing to parse and reaches nobody.
        raw.onmidimessage?.({ data: null, timeStamp: 456 });
        expect(received).toHaveLength(1);
    });

    it("wires and unhooks the statechange handler through close", async () => {
        const raw: StubInput = {
            id: "in-1",
            name: "Piano",
            manufacturer: "Acme",
            state: "connected",
            onmidimessage: null,
        };
        const access = stubAccess([raw]);
        withAccess(access);
        const connection = await webMidi.request();

        const onChange = vi.fn();
        connection.onStateChange(onChange);
        access.onstatechange?.();
        expect(onChange).toHaveBeenCalledTimes(1);

        connection.inputs()[0]?.onMessage(() => {});
        expect(raw.onmidimessage).not.toBeNull();
        connection.close();
        expect(access.onstatechange).toBeNull();
        expect(raw.onmidimessage).toBeNull();
    });

    it("reports the permission as unknown when the platform cannot say", async () => {
        const original = navigator.permissions;
        Object.defineProperty(navigator, "permissions", {
            configurable: true,
            value: { query: () => Promise.reject(new TypeError("no midi descriptor")) },
        });
        expect(await webMidi.permissionState()).toBe("unknown");
        Object.defineProperty(navigator, "permissions", { configurable: true, value: original });
    });
});
