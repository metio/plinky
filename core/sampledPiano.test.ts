// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import {
    playbackRateFor,
    regionFor,
    regionsNeeded,
    type SampleRegion,
    sampleCredit,
} from "./sampledPiano";

// A miniature of the library's own shape: two key centres a minor third apart, each split
// into a soft and a loud layer.
const REGIONS: SampleRegion[] = [
    { file: "C4v4.opus", keyCentre: 60, lowKey: 59, highKey: 61, lowVelocity: 1, highVelocity: 64 },
    {
        file: "C4v12.opus",
        keyCentre: 60,
        lowKey: 59,
        highKey: 61,
        lowVelocity: 65,
        highVelocity: 127,
    },
    { file: "Ds4v4.opus", keyCentre: 63, lowKey: 62, highKey: 64, lowVelocity: 1, highVelocity: 64 },
    {
        file: "Ds4v12.opus",
        keyCentre: 63,
        lowKey: 62,
        highKey: 64,
        lowVelocity: 65,
        highVelocity: 127,
    },
];

describe("regionFor", () => {
    it("takes the recording whose key and velocity both cover the note", () => {
        expect(regionFor(REGIONS, 60, 40)?.file).toBe("C4v4.opus");
        expect(regionFor(REGIONS, 60, 100)?.file).toBe("C4v12.opus");
        expect(regionFor(REGIONS, 63, 100)?.file).toBe("Ds4v12.opus");
    });

    it("reads the layer boundary the manifest draws, not one either side of it", () => {
        expect(regionFor(REGIONS, 60, 64)?.file).toBe("C4v4.opus");
        expect(regionFor(REGIONS, 60, 65)?.file).toBe("C4v12.opus");
    });

    it("falls to the nearest key rather than silence when nothing covers the note", () => {
        // Well above the sampled range: the top recording, not nothing.
        const found = regionFor(REGIONS, 84, 100);
        expect(found?.keyCentre).toBe(63);
    });

    it("prefers a near key over a near dynamic, since a bad shift is heard first", () => {
        // Two semitones below the lowest key, played hard. The nearer key wins even though
        // its velocity is further away.
        expect(regionFor(REGIONS, 57, 20)?.keyCentre).toBe(60);
    });

    it("has nothing to offer from an empty manifest", () => {
        expect(regionFor([], 60, 64)).toBeNull();
    });
});

describe("playbackRateFor", () => {
    it("plays a recording at its own speed when it is the note that was recorded", () => {
        expect(playbackRateFor(60, 60)).toBe(1);
    });

    it("shifts by semitones, an octave doubling the rate", () => {
        expect(playbackRateFor(72, 60)).toBeCloseTo(2);
        expect(playbackRateFor(48, 60)).toBeCloseTo(0.5);
        expect(playbackRateFor(61, 60)).toBeCloseTo(1.0595, 4);
    });
});

describe("regionsNeeded", () => {
    it("names each recording once, however often the piece asks for it", () => {
        const notes = [
            { pitch: 60, velocity: 40 },
            { pitch: 60, velocity: 40 },
            { pitch: 61, velocity: 40 },
            { pitch: 60, velocity: 100 },
        ];
        // Two files: C4 soft covers both 60 and 61, and C4 loud is the third note.
        expect(regionsNeeded(REGIONS, notes).map((region) => region.file).sort()).toEqual([
            "C4v4.opus",
            "C4v12.opus",
        ].sort());
    });

    it("asks for nothing when there is nothing to play", () => {
        expect(regionsNeeded(REGIONS, [])).toEqual([]);
    });
});

describe("sampleCredit", () => {
    it("names the instrument, its author and its licence", () => {
        expect(
            sampleCredit({
                instrument: "Salamander Grand Piano V3",
                author: "Alexander Holm",
                license: "CC-BY-3.0",
                source: "https://example.test",
                version: "v1",
                notes: [],
                releases: [],
            }),
        ).toBe("Salamander Grand Piano V3 by Alexander Holm · CC-BY-3.0");
    });
});
