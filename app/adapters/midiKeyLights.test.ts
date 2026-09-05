// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { NOTHING_LIT } from "../../core/keyLights";
import { defaultChannels } from "../../core/lightProfile";
import { createMidiKeyLights } from "./midiKeyLights";

// Casio's documented defaults: left-hand navigation on 3, right on 4.
const CASIO = () => defaultChannels("casio");

function recorder() {
    const sent: number[][] = [];
    return { sent, send: (data: number[]) => sent.push(data) };
}

describe("createMidiKeyLights", () => {
    it("lights a key as a note-on on its hand's channel", () => {
        const { sent, send } = recorder();
        createMidiKeyLights(send, CASIO).show({ left: [], right: [60] });
        // 0x93 = note-on, channel 4 (the wire counts from zero); 60 = middle C.
        expect(sent).toEqual([[0x93, 60, 127]]);
    });

    it("puts the left hand on its own channel", () => {
        const { sent, send } = recorder();
        createMidiKeyLights(send, CASIO).show({ left: [48], right: [] });
        expect(sent).toEqual([[0x92, 48, 127]]);
    });

    it("sends nothing at all for a picture it is already showing", () => {
        const { sent, send } = recorder();
        const lights = createMidiKeyLights(send, CASIO);
        lights.show({ left: [], right: [60] });
        lights.show({ left: [], right: [60] });
        // A second note-on for a key already lit is exactly the message whose meaning
        // no manual defines. Never generating one is why we need not find out.
        expect(sent).toHaveLength(1);
    });

    it("sends only the difference between two pictures", () => {
        const { sent, send } = recorder();
        const lights = createMidiKeyLights(send, CASIO);
        lights.show({ left: [], right: [60, 64] });
        sent.length = 0;
        lights.show({ left: [], right: [64, 67] });
        expect(sent).toEqual([
            [0x83, 60, 0],
            [0x93, 67, 127],
        ]);
    });

    it("extinguishes before it lights, so a key changing hands is never stranded", () => {
        const { sent, send } = recorder();
        const lights = createMidiKeyLights(send, CASIO);
        lights.show({ left: [60], right: [] });
        sent.length = 0;
        lights.show({ left: [], right: [60] });
        expect(sent).toEqual([
            [0x82, 60, 0],
            [0x93, 60, 127],
        ]);
    });

    it("puts out everything it lit, and only that", () => {
        const { sent, send } = recorder();
        const lights = createMidiKeyLights(send, CASIO);
        lights.show({ left: [48], right: [60] });
        sent.length = 0;
        lights.clear();
        expect(sent).toEqual([
            [0x82, 48, 0],
            [0x83, 60, 0],
        ]);
        // Clearing twice is a teardown that already happened, not a second round of
        // note-offs to a device that may since have gone.
        sent.length = 0;
        lights.clear();
        expect(sent).toEqual([]);
    });

    it("shows again after a clear, rather than thinking the key is still lit", () => {
        const { sent, send } = recorder();
        const lights = createMidiKeyLights(send, CASIO);
        lights.show({ left: [], right: [60] });
        lights.clear();
        sent.length = 0;
        lights.show({ left: [], right: [60] });
        expect(sent).toEqual([[0x93, 60, 127]]);
    });

    it("reads the channels afresh, so changing one in Settings takes effect at once", () => {
        const { sent, send } = recorder();
        let channels = { left: 3, right: 4 };
        const lights = createMidiKeyLights(send, () => channels);
        lights.show({ left: [], right: [60] });
        channels = { left: 15, right: 16 };
        sent.length = 0;
        lights.show({ left: [], right: [64] });
        // The key lit on channel 4 goes out on channel 4; the new one lights on 16.
        expect(sent).toEqual([
            [0x83, 60, 0],
            [0x9f, 64, 127],
        ]);
    });

    it("lights the same picture again on the new channels after a channel change", () => {
        // The Settings flow: Test, correct a channel, Test again. The second Test must
        // reach the instrument on the corrected channels, not diff away to nothing.
        const { sent, send } = recorder();
        let channels = { left: 3, right: 4 };
        const lights = createMidiKeyLights(send, () => channels);
        lights.show({ left: [48], right: [60] });
        channels = { left: 2, right: 1 };
        sent.length = 0;
        lights.show({ left: [48], right: [60] });
        expect(sent).toEqual([
            [0x82, 48, 0],
            [0x83, 60, 0],
            [0x91, 48, 127],
            [0x90, 60, 127],
        ]);
    });

    it("puts a key out on the channel it was lit on", () => {
        const { sent, send } = recorder();
        let channels = { left: 3, right: 4 };
        const lights = createMidiKeyLights(send, () => channels);
        lights.show({ left: [], right: [60] });
        channels = { left: 15, right: 16 };
        sent.length = 0;
        lights.clear();
        expect(sent).toEqual([[0x83, 60, 0]]);
    });

    it("says nothing when there is nothing to show", () => {
        const { sent, send } = recorder();
        createMidiKeyLights(send, CASIO).show(NOTHING_LIT);
        expect(sent).toEqual([]);
    });
});
