// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import {
    type Composition,
    decodeComposition,
    encodeComposition,
    quantize,
    type RecordedNote,
    toMidiNotes,
    toMusicXml,
    toReplayEvents,
    truncateTo,
} from "./composition";
import { packToCode } from "./shareCode";

function note(partial: Partial<RecordedNote>): RecordedNote {
    return { pitch: 60, startMs: 0, durationMs: 500, velocity: 90, ...partial };
}

const composition = (notes: RecordedNote[], tempo = 120, beatsPerBar = 4): Composition => ({
    notes,
    tempo,
    beatsPerBar,
});

describe("quantize", () => {
    it("snaps onsets and lengths to the nearest grid cell", () => {
        // At 120bpm a beat is 500ms; with four subdivisions the grid is 125ms.
        const snapped = quantize([note({ startMs: 130, durationMs: 240 })], 120, 4);
        expect(snapped[0]!.startMs).toBe(125);
        expect(snapped[0]!.durationMs).toBe(250);
    });

    it("never rounds a length below one grid cell", () => {
        const snapped = quantize([note({ startMs: 0, durationMs: 5 })], 120, 4);
        expect(snapped[0]!.durationMs).toBe(125);
    });

    it("leaves pitch and velocity untouched", () => {
        const snapped = quantize([note({ pitch: 67, velocity: 40 })], 120, 4);
        expect(snapped[0]!.pitch).toBe(67);
        expect(snapped[0]!.velocity).toBe(40);
    });
});

describe("truncateTo", () => {
    it("keeps only the first count notes", () => {
        const comp = composition([note({ pitch: 60 }), note({ pitch: 62 }), note({ pitch: 64 })]);
        expect(truncateTo(comp, 2).notes.map((n) => n.pitch)).toEqual([60, 62]);
    });

    it("clamps a negative count to empty", () => {
        const comp = composition([note({})]);
        expect(truncateTo(comp, -3).notes).toEqual([]);
    });
});

describe("toMidiNotes", () => {
    it("converts millisecond timings to quarter-note units", () => {
        // 120bpm: one quarter is 500ms.
        const midi = toMidiNotes(
            composition([note({ startMs: 1000, durationMs: 500, pitch: 64 })]),
        );
        expect(midi).toEqual([{ midi: 64, startQuarters: 2, durationQuarters: 1, velocity: 90 }]);
    });
});

describe("toReplayEvents", () => {
    it("turns a run of single notes into one event each, in onset order", () => {
        const events = toReplayEvents(
            composition([
                note({ startMs: 0, pitch: 60 }),
                note({ startMs: 500, pitch: 62 }),
                note({ startMs: 900, pitch: 64 }),
            ]),
        );
        expect(events.map((event) => event.atMs)).toEqual([0, 500, 900]);
        expect(events.map((event) => event.notes.map((n) => n.pitch))).toEqual([[60], [62], [64]]);
    });

    it("groups notes struck at the same onset into one chord event", () => {
        const events = toReplayEvents(
            composition([
                note({ startMs: 250, pitch: 60 }),
                note({ startMs: 250, pitch: 64 }),
                note({ startMs: 250, pitch: 67 }),
                note({ startMs: 800, pitch: 72 }),
            ]),
        );
        expect(events).toHaveLength(2);
        expect(events[0]!.atMs).toBe(250);
        expect(events[0]!.notes.map((n) => n.pitch)).toEqual([60, 64, 67]);
        expect(events[1]!.notes.map((n) => n.pitch)).toEqual([72]);
    });

    it("orders events by onset even when the notes arrive out of order", () => {
        const events = toReplayEvents(
            composition([
                note({ startMs: 900, pitch: 64 }),
                note({ startMs: 0, pitch: 60 }),
                note({ startMs: 500, pitch: 62 }),
            ]),
        );
        expect(events.map((event) => event.atMs)).toEqual([0, 500, 900]);
    });

    it("carries each note's exact pitch, held length and velocity", () => {
        const events = toReplayEvents(
            composition([note({ startMs: 100, pitch: 67, durationMs: 333, velocity: 51 })]),
        );
        expect(events[0]!.notes[0]).toEqual({ pitch: 67, durationMs: 333, velocity: 51 });
    });

    it("returns no events for an empty performance", () => {
        expect(toReplayEvents(composition([]))).toEqual([]);
    });

    it("spaces events by the recorded gaps, not by any notated grid", () => {
        // Two notes bunched close, then a long pause — the very shape (a quick pair
        // followed by a wait) that the old cursor-coupled replay flattened, playing the
        // pair almost together and then stalling. The gaps between events must mirror the
        // onsets exactly, whatever a score's ties or rests might imply.
        const events = toReplayEvents(
            composition([note({ startMs: 0 }), note({ startMs: 120 }), note({ startMs: 2120 })]),
        );
        const gaps = events.slice(1).map((event, index) => event.atMs - events[index]!.atMs);
        expect(gaps).toEqual([120, 2000]);
    });
});

describe("encode/decode round-trip", () => {
    it("restores a composition through the share codec", () => {
        const comp = composition(
            [
                note({ pitch: 60, startMs: 0, durationMs: 480, velocity: 88 }),
                note({ pitch: 64, startMs: 500, durationMs: 240, velocity: 70 }),
                note({ pitch: 67, startMs: 1000, durationMs: 1000, velocity: 110 }),
            ],
            96,
            3,
        );
        const decoded = decodeComposition(encodeComposition(comp));
        expect(decoded).toEqual(comp);
    });

    it("rounds fractional timings to whole milliseconds", () => {
        const comp = composition([note({ startMs: 100.6, durationMs: 249.4 })]);
        const decoded = decodeComposition(encodeComposition(comp));
        expect(decoded!.notes[0]!.startMs).toBe(101);
        expect(decoded!.notes[0]!.durationMs).toBe(249);
    });

    it("round-trips an empty composition", () => {
        const decoded = decodeComposition(encodeComposition(composition([])));
        expect(decoded).toEqual(composition([]));
    });

    it("rejects a share code with a non-positive or non-finite tempo or meter", () => {
        // An untrusted ?c= must not feed 0/NaN into 60_000 / tempo downstream.
        expect(decodeComposition(encodeComposition(composition([], 0, 4)))).toBeNull();
        expect(decodeComposition(encodeComposition(composition([], Number.NaN, 4)))).toBeNull();
        expect(decodeComposition(encodeComposition(composition([], 120, 0)))).toBeNull();
    });

    it("returns null for a malformed code", () => {
        expect(decodeComposition("not-a-real-code")).toBeNull();
        expect(decodeComposition("")).toBeNull();
    });

    it("rejects a payload whose columns disagree in length", () => {
        // Shape is valid JSON for the codec but the pitch column is short.
        const code = packToCode([120, 4, [0, 100], [100, 100], [60], [90, 90]]);
        expect(decodeComposition(code)).toBeNull();
    });
});

describe("toMusicXml", () => {
    const parse = (xml: string) => new DOMParser().parseFromString(xml, "application/xml");

    it("produces well-formed MusicXML", () => {
        const comp = composition([note({ pitch: 60, startMs: 0, durationMs: 500 })]);
        const doc = parse(toMusicXml(comp));
        expect(doc.querySelector("parsererror")).toBeNull();
        expect(doc.querySelector("score-partwise")).not.toBeNull();
    });

    it("splits notes across the two staves at the split point", () => {
        const comp = composition([
            note({ pitch: 72, startMs: 0, durationMs: 500 }), // treble
            note({ pitch: 48, startMs: 0, durationMs: 500 }), // bass
        ]);
        const doc = parse(toMusicXml(comp));
        const staves = [...doc.querySelectorAll("note > staff")].map((s) => s.textContent);
        expect(staves).toContain("1");
        expect(staves).toContain("2");
        // The high note carries the treble pitch, the low note the bass pitch.
        const octaves = [...doc.querySelectorAll("note > pitch > octave")].map(
            (o) => o.textContent,
        );
        expect(octaves).toContain("5"); // C5 = 72
        expect(octaves).toContain("3"); // C3 = 48
    });

    it("each measure's voice fills exactly one bar of divisions", () => {
        const comp = composition(
            [
                note({ pitch: 60, startMs: 0, durationMs: 500 }),
                note({ pitch: 62, startMs: 500, durationMs: 500 }),
                note({ pitch: 64, startMs: 1000, durationMs: 1000 }),
            ],
            120,
            4,
        );
        const doc = parse(toMusicXml(comp));
        // Four divisions per quarter, four quarters per bar.
        const barDivisions = 16;
        for (const measure of doc.querySelectorAll("measure")) {
            let trebleSum = 0;
            let backupSeen = false;
            for (const child of measure.children) {
                if (child.tagName === "backup") {
                    backupSeen = true;
                }
                // Chord notes sound atop the first and don't advance time, so they
                // don't count toward the bar's filled duration.
                if (child.tagName === "note" && !backupSeen && !child.querySelector("chord")) {
                    trebleSum += Number(child.querySelector("duration")?.textContent ?? 0);
                }
            }
            expect(trebleSum).toBe(barDivisions);
        }
    });

    it("ties a note that crosses a barline rather than re-striking it", () => {
        // A two-bar-long note at 120bpm/4-4: 4 seconds spans two whole bars.
        const comp = composition([note({ pitch: 60, startMs: 0, durationMs: 4000 })], 120, 4);
        const doc = parse(toMusicXml(comp));
        expect(doc.querySelector('tie[type="start"]')).not.toBeNull();
        expect(doc.querySelector('tie[type="stop"]')).not.toBeNull();
    });

    it("renders an empty composition as a single resting bar", () => {
        const doc = parse(toMusicXml(composition([])));
        expect(doc.querySelectorAll("measure").length).toBe(1);
        expect(doc.querySelector("rest")).not.toBeNull();
    });

    it("renders simultaneous notes on one staff as a block chord", () => {
        // A C-major triad struck together in the right hand.
        const comp = composition([
            note({ pitch: 60, startMs: 0, durationMs: 500 }),
            note({ pitch: 64, startMs: 0, durationMs: 500 }),
            note({ pitch: 67, startMs: 0, durationMs: 500 }),
        ]);
        const doc = parse(toMusicXml(comp));
        // Three notes at the onset, the upper two flagged as chord members.
        const chordNotes = doc.querySelectorAll("note > chord");
        expect(chordNotes.length).toBe(2);
        const octaves = [...doc.querySelectorAll("note > pitch")].map(
            (p) =>
                `${p.querySelector("step")?.textContent}${p.querySelector("octave")?.textContent}`,
        );
        expect(octaves).toEqual(["C4", "E4", "G4"]);
    });

    it("spells a black key with a sharp accidental", () => {
        const comp = composition([note({ pitch: 61, startMs: 0, durationMs: 500 })]); // C#4
        const doc = parse(toMusicXml(comp));
        expect(doc.querySelector("accidental")?.textContent).toBe("sharp");
        expect(doc.querySelector("alter")?.textContent).toBe("1");
    });
});

const parseDom = (xml: string) => new DOMParser().parseFromString(xml, "application/xml");

describe("decodeComposition rejects a payload malformed in exactly one field", () => {
    // Each payload is a valid one-note composition (tempo 120, 4/4, four length-1 columns)
    // save for the single field named — so a dropped or flipped validation guard would
    // wrongly accept it, and the mutant is caught.
    it("accepts the reference payload every rejection is derived from", () => {
        expect(decodeComposition(packToCode([120, 4, [0], [100], [60], [90]]))).not.toBeNull();
    });

    it.each([
        ["the tuple is too short", [120, 4, [0], [100], [60]]],
        ["the tuple is too long", [120, 4, [0], [100], [60], [90], [0]]],
        ["the tempo is not a number", ["120", 4, [0], [100], [60], [90]]],
        ["the tempo is zero", [0, 4, [0], [100], [60], [90]]],
        ["the tempo is negative", [-5, 4, [0], [100], [60], [90]]],
        ["the meter is not a number", [120, "4", [0], [100], [60], [90]]],
        ["the meter is zero", [120, 0, [0], [100], [60], [90]]],
        ["the meter is negative", [120, -2, [0], [100], [60], [90]]],
        ["the gap column is not an array", [120, 4, 0, [100], [60], [90]]],
        ["the duration column is not an array", [120, 4, [0], 100, [60], [90]]],
        ["the pitch column is not an array", [120, 4, [0], [100], 60, [90]]],
        ["the velocity column is not an array", [120, 4, [0], [100], [60], 90]],
        ["a gap is not a number", [120, 4, ["x"], [100], [60], [90]]],
        ["a pitch is not a number", [120, 4, [0], [100], ["x"], [90]]],
        ["the duration column is longer than the gaps", [120, 4, [0], [100, 100], [60], [90]]],
        ["the pitch column is longer than the gaps", [120, 4, [0], [100], [60, 61], [90]]],
        ["the velocity column is longer than the gaps", [120, 4, [0], [100], [60], [90, 91]]],
    ])("returns null when %s", (_why, payload) => {
        expect(decodeComposition(packToCode(payload))).toBeNull();
    });
});

describe("toMusicXml pitch spelling", () => {
    const single = (pitch: number) =>
        toMusicXml(composition([note({ pitch, startMs: 0, durationMs: 500 })]));

    // Every pitch class spelled with sharps, plus the octave arithmetic at C3/C4/C5.
    it.each([
        [60, "<pitch><step>C</step><octave>4</octave></pitch>", false],
        [61, "<pitch><step>C</step><alter>1</alter><octave>4</octave></pitch>", true],
        [62, "<pitch><step>D</step><octave>4</octave></pitch>", false],
        [63, "<pitch><step>D</step><alter>1</alter><octave>4</octave></pitch>", true],
        [64, "<pitch><step>E</step><octave>4</octave></pitch>", false],
        [65, "<pitch><step>F</step><octave>4</octave></pitch>", false],
        [66, "<pitch><step>F</step><alter>1</alter><octave>4</octave></pitch>", true],
        [67, "<pitch><step>G</step><octave>4</octave></pitch>", false],
        [68, "<pitch><step>G</step><alter>1</alter><octave>4</octave></pitch>", true],
        [69, "<pitch><step>A</step><octave>4</octave></pitch>", false],
        [70, "<pitch><step>A</step><alter>1</alter><octave>4</octave></pitch>", true],
        [71, "<pitch><step>B</step><octave>4</octave></pitch>", false],
        [72, "<pitch><step>C</step><octave>5</octave></pitch>", false],
        [48, "<pitch><step>C</step><octave>3</octave></pitch>", false],
    ])("spells MIDI %i", (pitch, fragment, sharp) => {
        const xml = single(pitch as number);
        expect(xml).toContain(fragment as string);
        expect(xml.includes("<accidental>sharp</accidental>")).toBe(sharp as boolean);
    });
});

describe("toMusicXml note values", () => {
    // A single note starting on the downbeat renders as exactly one note value.
    it.each([
        [2000, 16, "whole", ""],
        [1500, 12, "half", "<dot/>"],
        [1000, 8, "half", ""],
        [750, 6, "quarter", "<dot/>"],
        [500, 4, "quarter", ""],
        [375, 3, "eighth", "<dot/>"],
        [250, 2, "eighth", ""],
        [125, 1, "16th", ""],
    ])("renders %ims as a %s of %i cells", (durationMs, cells, type, dot) => {
        const xml = toMusicXml(composition([note({ pitch: 60, startMs: 0, durationMs }, )]));
        expect(xml).toContain(
            `<note><pitch><step>C</step><octave>4</octave></pitch><duration>${cells}</duration><type>${type}</type>${dot}<staff>1</staff></note>`,
        );
    });

    it("decomposes an odd length into tied values, longest first", () => {
        // 875ms at 120bpm = 7 sixteenth cells = a dotted quarter (6) tied to a 16th (1).
        const xml = toMusicXml(composition([note({ pitch: 60, startMs: 0, durationMs: 875 })]));
        expect(xml).toContain(
            `<note><pitch><step>C</step><octave>4</octave></pitch><duration>6</duration><tie type="start"/><type>quarter</type><dot/><staff>1</staff><notations><tied type="start"/></notations></note>`,
        );
        expect(xml).toContain(
            `<note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration><tie type="stop"/><type>16th</type><staff>1</staff><notations><tied type="stop"/></notations></note>`,
        );
    });
});

describe("toMusicXml reduces one hand to a single voice", () => {
    it("holds a chord for its longest note", () => {
        // C for a quarter and E for a half struck together become one half-note chord.
        const xml = toMusicXml(
            composition([
                note({ pitch: 60, startMs: 0, durationMs: 500 }),
                note({ pitch: 64, startMs: 0, durationMs: 1000 }),
            ]),
        );
        expect(xml).toContain(
            `<note><pitch><step>C</step><octave>4</octave></pitch><duration>8</duration><type>half</type><staff>1</staff></note>`,
        );
        expect(xml).toContain(
            `<note><chord/><pitch><step>E</step><octave>4</octave></pitch><duration>8</duration><type>half</type><staff>1</staff></note>`,
        );
    });

    it("clips a note so it never runs into the next onset", () => {
        // A 2s C would fill a whole bar, but a D lands a quarter later, so C is cut short.
        const xml = toMusicXml(
            composition([
                note({ pitch: 60, startMs: 0, durationMs: 2000 }),
                note({ pitch: 62, startMs: 500, durationMs: 500 }),
            ]),
        );
        expect(xml).toContain(
            `<note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration><type>quarter</type><staff>1</staff></note>`,
        );
        expect(xml).not.toContain("<type>whole</type><staff>1</staff>");
    });

    it("opens with a rest when the first note is late", () => {
        const first = parseDom(
            toMusicXml(composition([note({ pitch: 60, startMs: 500, durationMs: 500 })])),
        ).querySelector("measure > note");
        expect(first?.querySelector("rest")).not.toBeNull();
        expect(first?.querySelector("duration")?.textContent).toBe("4");
    });

    it("ties a note across a barline but never a rest", () => {
        // A note arriving in bar 2 leaves bar 1 an untied whole rest; the rest is split at
        // the barline without a tie, since only sounding notes carry one.
        const xml = toMusicXml(
            composition([note({ pitch: 60, startMs: 2500, durationMs: 500 })], 120, 4),
        );
        expect(xml).toContain(
            `<note><rest/><duration>16</duration><type>whole</type><staff>1</staff></note>`,
        );
        for (const element of parseDom(xml).querySelectorAll("note")) {
            if (element.querySelector("rest")) {
                expect(element.querySelector("tie")).toBeNull();
            }
        }
    });
});

describe("toMusicXml document scaffold", () => {
    const basic = () => toMusicXml(composition([note({ pitch: 60, startMs: 0, durationMs: 500 })]));

    it("emits the XML prolog and the score-partwise root", () => {
        const xml = basic();
        expect(xml).toContain(`<?xml version="1.0" encoding="UTF-8"?>`);
        expect(xml).toContain(`<score-partwise version="3.1">`);
    });

    it("declares a single two-staff piano part", () => {
        expect(basic()).toContain(
            `<part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list>`,
        );
    });

    it("writes the divisions, key, time signature and both clefs", () => {
        expect(basic()).toContain(
            `<attributes><divisions>4</divisions><key><fifths>0</fifths></key><time><beats>4</beats><beat-type>4</beat-type></time><staves>2</staves><clef number="1"><sign>G</sign><line>2</line></clef><clef number="2"><sign>F</sign><line>4</line></clef></attributes>`,
        );
    });

    it("carries the tempo as a rounded metronome mark", () => {
        expect(toMusicXml(composition([note({})], 119.6))).toContain(
            `<direction placement="above"><direction-type><metronome><beat-unit>quarter</beat-unit><per-minute>120</per-minute></metronome></direction-type><sound tempo="120"/></direction>`,
        );
    });

    it("titles the sketch 'Improvisation' by default", () => {
        expect(basic()).toContain(`<work><work-title>Improvisation</work-title></work>`);
    });

    it("uses and XML-escapes a custom title", () => {
        expect(toMusicXml(composition([note({})]), { title: "Jazz & <B>" })).toContain(
            `<work><work-title>Jazz &amp; &lt;B&gt;</work-title></work>`,
        );
    });

    it("backs up a whole bar of divisions between the two staves", () => {
        expect(toMusicXml(composition([note({})], 120, 4))).toContain(
            `<backup><duration>16</duration></backup>`,
        );
        expect(toMusicXml(composition([note({})], 120, 3))).toContain(
            `<backup><duration>12</duration></backup>`,
        );
    });

    it("takes the bar length from the meter, falling back to 4/4 when non-positive", () => {
        expect(toMusicXml(composition([note({})], 120, 3))).toContain("<beats>3</beats>");
        expect(toMusicXml(composition([note({})], 120, 0))).toContain("<beats>4</beats>");
    });

    it("numbers measures from one and rounds the piece up to whole bars", () => {
        const bars = (durationMs: number) =>
            parseDom(
                toMusicXml(composition([note({ pitch: 60, startMs: 0, durationMs })], 120, 4)),
            ).querySelectorAll("measure").length;
        // 2000ms fills exactly one 4/4 bar; a hair more spills into a second.
        expect(bars(2000)).toBe(1);
        expect(bars(2125)).toBe(2);
        const twoBars = toMusicXml(
            composition([note({ pitch: 60, startMs: 0, durationMs: 4000 })], 120, 4),
        );
        expect(twoBars).toContain(`<measure number="1">`);
        expect(twoBars).toContain(`<measure number="2">`);
    });

    it("splits hands at middle C by default and at a custom split point on request", () => {
        // Default split is 60: middle C is treble (staff 1), the B below it bass (staff 2).
        const def = toMusicXml(
            composition([
                note({ pitch: 60, startMs: 0, durationMs: 500 }),
                note({ pitch: 59, startMs: 0, durationMs: 500 }),
            ]),
        );
        expect(def).toContain(
            `<pitch><step>C</step><octave>4</octave></pitch><duration>4</duration><type>quarter</type><staff>1</staff>`,
        );
        expect(def).toContain(
            `<pitch><step>B</step><octave>3</octave></pitch><duration>4</duration><type>quarter</type><staff>2</staff>`,
        );
        // Raising the split to 62 drops middle C to the bass staff.
        expect(
            toMusicXml(composition([note({ pitch: 60, startMs: 0, durationMs: 500 })]), {
                splitPoint: 62,
            }),
        ).toContain(
            `<pitch><step>C</step><octave>4</octave></pitch><duration>4</duration><type>quarter</type><staff>2</staff>`,
        );
    });

    it("snaps onto a coarser grid when given fewer subdivisions per beat", () => {
        // Two notes 200ms apart stay separate on the default 16th grid, but a
        // one-subdivision-per-beat grid pulls both onto the downbeat as a chord.
        const notes = [
            note({ pitch: 60, startMs: 0, durationMs: 500 }),
            note({ pitch: 64, startMs: 200, durationMs: 500 }),
        ];
        expect(toMusicXml(composition(notes)).includes("<chord/>")).toBe(false);
        expect(
            toMusicXml(composition(notes), { subdivisionsPerBeat: 1 }).includes("<chord/>"),
        ).toBe(true);
    });
});

describe("toMidiNotes scales by the beat length", () => {
    it("measures onset and length in quarter notes at the given tempo", () => {
        // At 60bpm a quarter is 1000ms, so 2000ms is beat 2 and 500ms is half a beat.
        expect(toMidiNotes(composition([note({ startMs: 2000, durationMs: 500, pitch: 60 })], 60))).toEqual([
            { midi: 60, startQuarters: 2, durationQuarters: 0.5, velocity: 90 },
        ]);
    });
});

// The renderer is deterministic, so a couple of small performances are pinned to their
// exact serialization: this catches the whitespace joins, the once-per-part header and
// any stray output no structural assertion would notice.
const GOLDEN_TWO_HANDS = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="3.1">
  <work><work-title>Improvisation</work-title></work>
  <part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list>
  <part id="P1">
    <measure number="1">
      <attributes><divisions>4</divisions><key><fifths>0</fifths></key><time><beats>4</beats><beat-type>4</beat-type></time><staves>2</staves><clef number="1"><sign>G</sign><line>2</line></clef><clef number="2"><sign>F</sign><line>4</line></clef></attributes>
      <direction placement="above"><direction-type><metronome><beat-unit>quarter</beat-unit><per-minute>120</per-minute></metronome></direction-type><sound tempo="120"/></direction>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration><type>quarter</type><staff>1</staff></note>
      <note><rest/><duration>12</duration><type>half</type><dot/><staff>1</staff></note>
      <backup><duration>16</duration></backup>
      <note><pitch><step>C</step><octave>3</octave></pitch><duration>4</duration><type>quarter</type><staff>2</staff></note>
      <note><rest/><duration>12</duration><type>half</type><dot/><staff>2</staff></note>
    </measure>
  </part>
</score-partwise>
`;

const GOLDEN_TWO_BARS = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="3.1">
  <work><work-title>Improvisation</work-title></work>
  <part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list>
  <part id="P1">
    <measure number="1">
      <attributes><divisions>4</divisions><key><fifths>0</fifths></key><time><beats>4</beats><beat-type>4</beat-type></time><staves>2</staves><clef number="1"><sign>G</sign><line>2</line></clef><clef number="2"><sign>F</sign><line>4</line></clef></attributes>
      <direction placement="above"><direction-type><metronome><beat-unit>quarter</beat-unit><per-minute>120</per-minute></metronome></direction-type><sound tempo="120"/></direction>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>16</duration><tie type="start"/><type>whole</type><staff>1</staff><notations><tied type="start"/></notations></note>
      <backup><duration>16</duration></backup>
      <note><rest/><duration>16</duration><type>whole</type><staff>2</staff></note>
    </measure>
    <measure number="2">
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>16</duration><tie type="stop"/><type>whole</type><staff>1</staff><notations><tied type="stop"/></notations></note>
      <backup><duration>16</duration></backup>
      <note><rest/><duration>16</duration><type>whole</type><staff>2</staff></note>
    </measure>
  </part>
</score-partwise>
`;

describe("toMusicXml serializes exactly", () => {
    it("engraves a quarter note in each hand", () => {
        const comp = composition([
            note({ pitch: 60, startMs: 0, durationMs: 500 }),
            note({ pitch: 48, startMs: 0, durationMs: 500 }),
        ]);
        expect(toMusicXml(comp)).toBe(GOLDEN_TWO_HANDS);
    });

    it("engraves a note tied across a barline, the header only on the first measure", () => {
        const comp = composition([note({ pitch: 60, startMs: 0, durationMs: 4000 })], 120, 4);
        expect(toMusicXml(comp)).toBe(GOLDEN_TWO_BARS);
    });
});

describe("toMusicXml orders a voice in time and pitch", () => {
    const steps = (xml: string) =>
        [...parseDom(xml).querySelectorAll("note > pitch > step")].map((s) => s.textContent);

    it("lays a hand's notes out by onset even when recorded out of order", () => {
        const xml = toMusicXml(
            composition([
                note({ pitch: 64, startMs: 1000, durationMs: 500 }),
                note({ pitch: 60, startMs: 0, durationMs: 500 }),
                note({ pitch: 62, startMs: 500, durationMs: 500 }),
            ]),
        );
        expect(steps(xml)).toEqual(["C", "D", "E"]);
    });

    it("stacks a chord bottom-up regardless of strike order", () => {
        const xml = toMusicXml(
            composition([
                note({ pitch: 67, startMs: 0, durationMs: 500 }),
                note({ pitch: 60, startMs: 0, durationMs: 500 }),
                note({ pitch: 64, startMs: 0, durationMs: 500 }),
            ]),
        );
        expect(steps(xml)).toEqual(["C", "E", "G"]);
        // The chord members sit on their own lines, each carrying <chord/> after the first.
        expect(xml).toContain(
            `<note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration><type>quarter</type><staff>1</staff></note>\n      <note><chord/><pitch><step>E</step>`,
        );
    });
});

describe("toMusicXml lays out one voice without gaps or overlaps", () => {
    it("rests exactly the gap between two separated notes", () => {
        // C on the downbeat, D two beats later: a quarter note, a quarter rest, a quarter note.
        const xml = toMusicXml(
            composition([
                note({ pitch: 60, startMs: 0, durationMs: 500 }),
                note({ pitch: 62, startMs: 1000, durationMs: 500 }),
            ]),
        );
        expect(xml).toContain(
            `<note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration><type>quarter</type><staff>1</staff></note>\n      <note><rest/><duration>4</duration><type>quarter</type><staff>1</staff></note>\n      <note><pitch><step>D</step><octave>4</octave></pitch><duration>4</duration><type>quarter</type><staff>1</staff></note>`,
        );
    });

    it("clips a mid-phrase note to the following onset", () => {
        // A long D between a C and an E is cut to a quarter so it never overruns the E.
        const xml = toMusicXml(
            composition([
                note({ pitch: 60, startMs: 0, durationMs: 500 }),
                note({ pitch: 62, startMs: 500, durationMs: 2000 }),
                note({ pitch: 64, startMs: 1000, durationMs: 500 }),
            ]),
        );
        expect(xml).toContain(
            `<note><pitch><step>D</step><octave>4</octave></pitch><duration>4</duration><type>quarter</type><staff>1</staff></note>`,
        );
    });

    it("splits a bar-crossing note so each bar still fills exactly", () => {
        // A quarter then a note running from beat 2 past the barline: bar 1 must still total 16.
        const doc = parseDom(
            toMusicXml(
                composition(
                    [
                        note({ pitch: 60, startMs: 0, durationMs: 500 }),
                        note({ pitch: 62, startMs: 500, durationMs: 1875 }),
                    ],
                    120,
                    4,
                ),
            ),
        );
        const measure = doc.querySelector("measure")!;
        let trebleSum = 0;
        let backupSeen = false;
        for (const child of measure.children) {
            if (child.tagName === "backup") {
                backupSeen = true;
            }
            if (child.tagName === "note" && !backupSeen && !child.querySelector("chord")) {
                trebleSum += Number(child.querySelector("duration")?.textContent ?? 0);
            }
        }
        expect(trebleSum).toBe(16);
    });
});
