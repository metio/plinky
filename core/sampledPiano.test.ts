// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import {
    extrasFor,
    samplesEnabled,
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
    {
        file: "Ds4v4.opus",
        keyCentre: 63,
        lowKey: 62,
        highKey: 64,
        lowVelocity: 1,
        highVelocity: 64,
    },
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
        expect(
            regionsNeeded(REGIONS, notes)
                .map((region) => region.file)
                .sort(),
        ).toEqual(["C4v4.opus", "C4v12.opus"].sort());
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

// The extras a pack ships beside its struck notes: the key-off knock and the sympathetic
// resonance, over the same key range.
const EXTRAS: SampleRegion[] = [
    {
        file: "knock-C4.opus",
        kind: "knock",
        keyCentre: 60,
        lowKey: 48,
        highKey: 72,
        lowVelocity: 1,
        highVelocity: 127,
    },
    {
        file: "resonance-C4.opus",
        kind: "resonance",
        keyCentre: 60,
        lowKey: 48,
        highKey: 72,
        lowVelocity: 1,
        highVelocity: 127,
    },
    {
        file: "knock-C6.opus",
        kind: "knock",
        keyCentre: 84,
        lowKey: 73,
        highKey: 96,
        lowVelocity: 1,
        highVelocity: 127,
    },
];

describe("extrasFor", () => {
    it("answers a knock with a knock and a resonance with a resonance", () => {
        expect(extrasFor(EXTRAS, 60, 90, "knock")?.file).toBe("knock-C4.opus");
        expect(extrasFor(EXTRAS, 60, 90, "resonance")?.file).toBe("resonance-C4.opus");
    });

    it("never answers one kind with the nearest recording of the other", () => {
        // Filtered before the nearest-match walk, not after. A resonance sitting closer to
        // the key than any knock would otherwise be played as the key-off noise, and the
        // closest recording of the wrong sound is worse than no sound at all.
        const onlyResonance = EXTRAS.filter((region) => region.kind === "resonance");
        expect(extrasFor(onlyResonance, 60, 90, "knock")).toBeNull();
    });

    it("picks the nearest key centre within a kind", () => {
        expect(extrasFor(EXTRAS, 90, 90, "knock")?.file).toBe("knock-C6.opus");
    });

    it("ignores struck notes, which carry no kind", () => {
        // An older pack, or the notes list handed in by mistake: neither is an extra, and
        // playing a struck note as a key-off knock would be a second note.
        expect(extrasFor(REGIONS, 60, 90, "knock")).toBeNull();
    });
});

describe("regionsNeeded for extras", () => {
    it("prefetches the extras a passage will knock and ring", () => {
        // The key-off noise has to be decoded before the key comes up, which is at most a
        // second after it went down — so it is prefetched with the notes, not on release.
        const notes = [
            { pitch: 60, velocity: 90 },
            { pitch: 90, velocity: 40 },
        ];
        expect(regionsNeeded(EXTRAS, notes, "knock").map((region) => region.file)).toEqual([
            "knock-C4.opus",
            "knock-C6.opus",
        ]);
        expect(regionsNeeded(EXTRAS, notes, "resonance").map((region) => region.file)).toEqual([
            "resonance-C4.opus",
        ]);
    });

    it("still means struck notes when no kind is asked for", () => {
        const files = regionsNeeded(REGIONS, [{ pitch: 60, velocity: 90 }]).map((r) => r.file);
        expect(files.length).toBe(1);
        expect(files[0]).toMatch(/^C4v/);
    });
});

describe("samplesEnabled", () => {
    it("is on for a device that has never been asked", () => {
        // The whole point of the default. A new device, a cleared store, or a player who has
        // never opened Settings all read as null here, and all of them should hear the
        // recorded piano — while this answered false, almost nobody ever did.
        expect(samplesEnabled(null)).toBe(true);
    });

    it("stays off for a player who turned it off", () => {
        expect(samplesEnabled("0")).toBe(false);
    });

    it("is on for a player who turned it on", () => {
        expect(samplesEnabled("1")).toBe(true);
    });

    it("treats a value it does not recognise as on rather than off", () => {
        // A store can hold anything — an older shape, something written by hand. Read the
        // other way round, an unrecognised value would silence the instrument, which is the
        // state this default exists to leave.
        expect(samplesEnabled("")).toBe(true);
        expect(samplesEnabled("yes")).toBe(true);
    });
});
