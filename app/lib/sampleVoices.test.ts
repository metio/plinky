// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import type { SampleManifest } from "../../core/sampledPiano";
import { fakeSampleSource } from "../adapters/fakeSampleSource";
import { sampleLookup } from "./sampleVoices";

const MANIFEST: SampleManifest = {
    instrument: "Salamander Grand Piano V3",
    author: "Alexander Holm",
    license: "CC-BY-3.0",
    source: "https://example.test",
    version: "v1",
    notes: [
        {
            file: "C4v4.opus",
            keyCentre: 60,
            lowKey: 59,
            highKey: 61,
            lowVelocity: 1,
            highVelocity: 64,
        },
        {
            file: "C4v12.opus",
            keyCentre: 60,
            lowKey: 59,
            highKey: 61,
            lowVelocity: 65,
            highVelocity: 127,
        },
    ],
    releases: [],
};

describe("sampleLookup", () => {
    it("plays the recording for the key and the force, at the speed that pitches it", () => {
        const source = fakeSampleSource(MANIFEST);
        source.put("C4v12.opus");
        const found = sampleLookup(source).voiceFor(61, 100);
        expect(found).not.toBeNull();
        // A semitone above the recorded key, so a semitone faster.
        expect(found?.rate).toBeCloseTo(1.0595, 4);
    });

    it("offers nothing for a recording that has not arrived, so the note still sounds", () => {
        // The whole contract: a key pressed now is answered now. An undecoded recording is
        // the synth's note, never a wait.
        const source = fakeSampleSource(MANIFEST);
        expect(sampleLookup(source).voiceFor(60, 100)).toBeNull();
    });

    it("offers nothing at all until the player has asked for the real piano", async () => {
        const source = fakeSampleSource(MANIFEST);
        source.put("C4v4.opus");
        await source.forget();
        expect(sampleLookup(source).voiceFor(60, 40)).toBeNull();
    });

    it("offers nothing without a manifest, which is how a device starts", () => {
        const source = fakeSampleSource(null);
        source.put("C4v4.opus");
        expect(sampleLookup(source).voiceFor(60, 40)).toBeNull();
    });
});
