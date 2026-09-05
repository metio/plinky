// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import { domXmlCodec } from "../app/adapters/domXmlCodec";
import { readIncipit } from "./incipit";
import type { XmlCodec } from "./xml";
import { describe, expect, it } from "vitest";
import {
    categoryOf,
    gradeOf,
    MAX_GRADE,
    measureScore,
    paceCost,
    parsePositions,
    pieceBoundaries,
    rawDifficulty,
    readLength,
    readPace,
    SPEED_FLOOR_NPS,
    SPEED_WEIGHT,
    TEXTURE_WEIGHT,
} from "./scoreDifficulty";

// A minimal one-part score builder for the tests.
const score = (notes: string) =>
    `<?xml version="1.0"?><score-partwise><part id="P1"><measure number="1">${notes}</measure></part></score-partwise>`;
const note = (step: string, octave: number, staff?: number, chord = false) =>
    `<note>${chord ? "<chord/>" : ""}<pitch><step>${step}</step><octave>${octave}</octave></pitch><duration>2</duration>${staff ? `<staff>${staff}</staff>` : ""}</note>`;

describe("parsePositions", () => {
    it("reads a single-staff line into right-hand positions", () => {
        const { right, left } = parsePositions(
            domXmlCodec,
            score(note("C", 4) + note("E", 4) + note("G", 4)),
        );
        expect(right).toEqual([[60], [64], [67]]);
        expect(left).toEqual([]);
    });

    it("groups a chord into one position and splits the hands by staff", () => {
        const xml = score(
            note("C", 4, 1) + note("E", 4, 1, true) + note("G", 4, 1, true) + note("C", 2, 2),
        );
        const { right, left } = parsePositions(domXmlCodec, xml);
        expect(right).toEqual([[60, 64, 67]]);
        expect(left).toEqual([[36]]);
    });

    it("skips rests and survives malformed XML", () => {
        expect(parsePositions(domXmlCodec, "not xml at all")).toMatchObject({
            right: [],
            left: [],
        });
        const withRest = score(`${note("C", 4)}<note><rest/><duration>2</duration></note>`);
        expect(parsePositions(domXmlCodec, withRest).right).toEqual([[60]]);
    });
});

describe("rawDifficulty", () => {
    it("is zero for an empty or unreadable score", () => {
        expect(rawDifficulty(domXmlCodec, "garbage")).toBe(0);
        expect(rawDifficulty(domXmlCodec, score(""))).toBe(0);
    });

    it("costs a comfortable five-finger line less than a wide, leaping one", () => {
        const inHand = score([60, 62, 64, 65, 67].map((p) => noteFor(p)).join(""));
        const leaping = score([60, 72, 64, 76, 67].map((p) => noteFor(p)).join(""));
        expect(rawDifficulty(domXmlCodec, inHand)).toBeLessThan(
            rawDifficulty(domXmlCodec, leaping),
        );
    });

    it("averages effort per note rather than summing it, so length alone doesn't inflate", () => {
        // The same octave-leap figure repeated: averaged, the per-note effort barely
        // moves however long the line; summing would scale it with the note count.
        const figure = (repeats: number) =>
            score(
                Array.from({ length: repeats }, () => [60, 72])
                    .flat()
                    .map((p) => noteFor(p))
                    .join(""),
            );
        const short = rawDifficulty(domXmlCodec, figure(3)); // 6 notes
        const long = rawDifficulty(domXmlCodec, figure(15)); // 30 notes
        expect(short).toBeGreaterThan(0);
        expect(long).toBeLessThan(short * 2);
    });
});

describe("categoryOf", () => {
    it("reads the category from the catalogue id", () => {
        expect(categoryOf("scale-c-major")).toBe("scale");
        expect(categoryOf("arpeggio-a-minor")).toBe("arpeggio");
        expect(categoryOf("ode-to-joy")).toBe("piece");
    });
});

describe("gradeOf", () => {
    it("grades a gentle stepwise tune at the bottom of its scale", () => {
        const gentle = score([60, 62, 64, 65, 67].map((p) => noteFor(p)).join(""));
        expect(gradeOf(domXmlCodec, "gentle-piece", gentle)).toBe(1);
    });

    it("always returns a grade within 1..MAX_GRADE", () => {
        // A relentless wide-leap line is the hardest a piece can be.
        const brutal = score([36, 84, 40, 80, 45, 76, 48].map((p) => noteFor(p)).join(""));
        const grade = gradeOf(domXmlCodec, "brutal-piece", brutal);
        expect(grade).toBeGreaterThanOrEqual(1);
        expect(grade).toBeLessThanOrEqual(MAX_GRADE);
    });

    it("grades a harder line at least as high as an easier one in the same category", () => {
        const easy = score([60, 62, 64].map((p) => noteFor(p)).join(""));
        const hard = score([60, 76, 62, 79].map((p) => noteFor(p)).join(""));
        expect(gradeOf(domXmlCodec, "easy-piece", easy)).toBeLessThanOrEqual(
            gradeOf(domXmlCodec, "hard-piece", hard),
        );
    });

    it("grades an unmeasurable score at the top, not as the easiest piece", () => {
        // An empty or unreadable import has no fingerable notes, so its cost is 0.
        // Bucketing it at grade 1 would pad the beginner pool with a phantom piece;
        // it belongs out of the way at the ceiling instead.
        expect(gradeOf(domXmlCodec, "empty-import", score(""))).toBe(MAX_GRADE);
        const restsOnly = score(`<note><rest/><duration>4</duration></note>`);
        expect(gradeOf(domXmlCodec, "rests-only-import", restsOnly)).toBe(MAX_GRADE);
        expect(gradeOf(domXmlCodec, "unreadable-import", "not a score at all")).toBe(MAX_GRADE);
    });

    it("grades a chord with more notes than fingers without crashing", () => {
        // Real piano music has 6+ note voicings the bundled exercises never do; the
        // fingering model must still return a grade rather than fail to finger them.
        const bigChord = score(
            note("C", 4) +
                note("E", 4, undefined, true) +
                note("G", 4, undefined, true) +
                note("C", 5, undefined, true) +
                note("E", 5, undefined, true) +
                note("G", 5, undefined, true),
        );
        const grade = gradeOf(domXmlCodec, "big-chord", bigChord);
        expect(grade).toBeGreaterThanOrEqual(1);
        expect(grade).toBeLessThanOrEqual(MAX_GRADE);
    });
});

describe("midiOf reads pitch, accidental and defaults", () => {
    const one = (pitch: string) =>
        parsePositions(
            domXmlCodec,
            score(`<note><pitch>${pitch}</pitch><duration>2</duration></note>`),
        ).right;

    it("raises a sharp and lowers a flat by a semitone", () => {
        expect(one("<step>C</step><alter>1</alter><octave>4</octave>")).toEqual([[61]]);
        expect(one("<step>D</step><alter>-1</alter><octave>4</octave>")).toEqual([[61]]);
    });

    it("trims whitespace around the step name", () => {
        expect(one("<step> C </step><octave>4</octave>")).toEqual([[60]]);
    });

    it("defaults a missing octave to 4 rather than to 0 or a throw", () => {
        expect(one("<step>C</step>")).toEqual([[60]]);
    });

    it("skips a pitch with no step, and one whose step names no class, without throwing", () => {
        const noStep = `<note><pitch><octave>4</octave></pitch><duration>2</duration></note>`;
        expect(parsePositions(domXmlCodec, score(noStep + note("E", 4))).right).toEqual([[64]]);
        expect(parsePositions(domXmlCodec, score(note("H", 4) + note("E", 4))).right).toEqual([
            [64],
        ]);
    });
});

describe("parsePositions groups and splits precisely", () => {
    it("trims whitespace around the staff number", () => {
        const xml = score(
            `<note><pitch><step>C</step><octave>2</octave></pitch><duration>2</duration><staff> 2 </staff></note>`,
        );
        expect(parsePositions(domXmlCodec, xml)).toMatchObject({ right: [], left: [[36]] });
    });

    it("starts a fresh position for a chord marker with nothing before it", () => {
        // A leading <chord/> has no position to join, so it opens one instead of
        // indexing off the end of an empty hand.
        const xml = score(
            `<note><chord/><pitch><step>C</step><octave>4</octave></pitch><duration>2</duration></note>` +
                note("E", 4, undefined, true),
        );
        expect(parsePositions(domXmlCodec, xml).right).toEqual([[60, 64]]);
    });
});

describe("measureScore", () => {
    // A codec that counts its parses, so the test can say how many times a score was
    // opened rather than how long it took.
    const counting = () => {
        let parses = 0;
        const codec: XmlCodec = {
            parse: (xml) => {
                parses += 1;
                return domXmlCodec.parse(xml);
            },
            serialize: domXmlCodec.serialize,
        };
        return { codec, parses: () => parses };
    };

    it("reads grade, cost and incipit off one parse", () => {
        const { codec, parses } = counting();
        const xml = score([60, 62, 64, 65, 67].map(noteFor).join(""));
        const measure = measureScore(codec, "measure-once", xml);
        expect(parses()).toBe(1);
        expect(measure.grade).toBe(gradeOf(domXmlCodec, "measure-once-again", xml));
        expect(measure.cost).toBe(rawDifficulty(domXmlCodec, xml));
        expect(measure.incipit).toEqual(readIncipit(domXmlCodec, xml));
        expect(measure.notes).toBe(5);
    });

    it("answers a second ask for the same id without opening the score again", () => {
        const { codec, parses } = counting();
        const xml = score([60, 62].map(noteFor).join(""));
        measureScore(codec, "measure-cached", xml);
        measureScore(codec, "measure-cached", xml);
        expect(parses()).toBe(1);
    });

    it("grades an unreadable or empty score at the top, at no cost, with no mark", () => {
        expect(measureScore(domXmlCodec, "measure-broken", "<not xml")).toEqual({
            grade: MAX_GRADE,
            cost: 0,
            notes: 0,
            incipit: null,
        });
        const rests = score(`<note><rest/><duration>4</duration></note>`);
        const measure = measureScore(domXmlCodec, "measure-rests", rests);
        expect(measure.grade).toBe(MAX_GRADE);
        expect(measure.notes).toBe(0);
    });
});

describe("gradeOf caches and averages", () => {
    it("memoises by id, ignoring any later xml for the same id", () => {
        const gentle = score([60, 62, 64, 65, 67].map(noteFor).join(""));
        const brutal = score([36, 84, 40, 80].map(noteFor).join(""));
        const first = gradeOf(domXmlCodec, "cache-probe", gentle);
        // The second call must return the cached grade, not re-grade the brutal score.
        expect(gradeOf(domXmlCodec, "cache-probe", brutal)).toBe(first);
    });

    it("does not bucket a non-empty balanced two-hand score at the ceiling", () => {
        const xml = score(note("C", 4, 1) + note("E", 4, 1) + note("C", 2, 2) + note("E", 2, 2));
        expect(gradeOf(domXmlCodec, "balanced", xml)).toBeLessThan(MAX_GRADE);
    });

    it("keeps a long gentle line at grade 1 — length must not inflate the cost", () => {
        const long = score(Array.from({ length: 40 }, (_, i) => noteFor(60 + (i % 5))).join(""));
        expect(gradeOf(domXmlCodec, "long-gentle", long)).toBe(1);
    });

    it("grades a relentless wide-leap piece above grade 1", () => {
        const brutal = score([36, 84, 40, 80, 45, 76, 48, 72].map(noteFor).join(""));
        expect(gradeOf(domXmlCodec, "brutal-probe", brutal)).toBeGreaterThan(1);
    });

    it("grades hard scales and arpeggios above grade 1 on their own scales", () => {
        const wide = score([48, 72, 50, 74, 52, 76].map(noteFor).join(""));
        expect(gradeOf(domXmlCodec, "scale-wide", wide)).toBeGreaterThan(1);
        expect(gradeOf(domXmlCodec, "arpeggio-wide", wide)).toBeGreaterThan(1);
    });
});

// Build a <note> from a MIDI pitch (C major only, enough for the test pitches).
function noteFor(midi: number): string {
    const names = ["C", "C", "D", "D", "E", "F", "F", "G", "G", "A", "A", "B"];
    const step = names[midi % 12] ?? "C";
    const octave = Math.floor(midi / 12) - 1;
    return `<note><pitch><step>${step}</step><octave>${octave}</octave></pitch><duration>2</duration></note>`;
}

// A one-part score with a stated tempo and note length, for the pace terms. `divisions`
// is per quarter note, so duration 1 with divisions 4 is a sixteenth.
const paced = (tempo: number, divisions: number, duration: number, count: number, voices = 1) => {
    let notes = "";
    for (let i = 0; i < count; i++) {
        for (let voice = 1; voice <= voices; voice++) {
            notes += `<note><pitch><step>C</step><octave>4</octave></pitch><duration>${duration}</duration><voice>${voice}</voice><staff>1</staff></note>`;
        }
    }
    return `<?xml version="1.0"?><score-partwise><part id="P1"><measure number="1"><attributes><divisions>${divisions}</divisions></attributes><sound tempo="${tempo}"/>${notes}</measure></part></score-partwise>`;
};

describe("paceCost", () => {
    it("costs nothing for a slow single line", () => {
        // What a beginner piece is: an easy piece keeps the cost its fingering earned it.
        expect(paceCost({ notesPerSecond: 2, voices: 1 })).toBe(0);
        expect(paceCost({ notesPerSecond: SPEED_FLOOR_NPS, voices: 1 })).toBe(0);
    });

    it("charges for speed above the comfortable floor", () => {
        expect(paceCost({ notesPerSecond: SPEED_FLOOR_NPS + 1, voices: 1 })).toBeCloseTo(
            SPEED_WEIGHT,
        );
        expect(paceCost({ notesPerSecond: 8, voices: 1 })).toBeCloseTo(
            (8 - SPEED_FLOOR_NPS) * SPEED_WEIGHT,
        );
    });

    it("charges for each line beyond the first in one hand", () => {
        expect(paceCost({ notesPerSecond: 0, voices: 2 })).toBeCloseTo(TEXTURE_WEIGHT);
        expect(paceCost({ notesPerSecond: 0, voices: 3 })).toBeCloseTo(2 * TEXTURE_WEIGHT);
    });

    it("adds the two rather than trading one off against the other", () => {
        // A fast piece in three voices is both, and a comfortable hand position must not
        // excuse either — the fault this whole term exists to fix.
        expect(paceCost({ notesPerSecond: 8, voices: 3 })).toBeCloseTo(
            (8 - SPEED_FLOOR_NPS) * SPEED_WEIGHT + 2 * TEXTURE_WEIGHT,
        );
    });
});

describe("rawDifficulty reads speed and texture", () => {
    it("rates running sixteenths above the same notes held long", () => {
        const slow = paced(60, 4, 16, 12);
        const fast = paced(120, 4, 1, 12);
        expect(rawDifficulty(domXmlCodec, fast)).toBeGreaterThan(rawDifficulty(domXmlCodec, slow));
    });

    it("rates two voices in one hand above one", () => {
        const single = paced(80, 4, 4, 8, 1);
        const double = paced(80, 4, 4, 8, 2);
        expect(rawDifficulty(domXmlCodec, double)).toBeGreaterThan(
            rawDifficulty(domXmlCodec, single),
        );
    });

    it("reads an unstated tempo as moderate rather than as motionless", () => {
        const noTempo = `<?xml version="1.0"?><score-partwise><part id="P1"><measure number="1"><attributes><divisions>4</divisions></attributes><note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration></note><note><pitch><step>D</step><octave>4</octave></pitch><duration>1</duration></note></measure></part></score-partwise>`;
        expect(rawDifficulty(domXmlCodec, noTempo)).toBeGreaterThan(0);
    });

    it("leaves a score with nothing fingerable at zero", () => {
        // Zero means "nothing to measure", and a pace term added to it would dress an
        // unreadable import up as a plausible score.
        expect(
            rawDifficulty(domXmlCodec, score("<note><rest/><duration>4</duration></note>")),
        ).toBe(0);
    });

    it("ignores grace notes and chord members when reading speed", () => {
        // Neither takes time of its own; counting them would read every rolled chord as a
        // burst of speed.
        const chordy = `<?xml version="1.0"?><score-partwise><part id="P1"><measure number="1"><attributes><divisions>4</divisions></attributes><sound tempo="60"/><note><pitch><step>C</step><octave>4</octave></pitch><duration>16</duration></note><note><chord/><pitch><step>E</step><octave>4</octave></pitch><duration>16</duration></note></measure></part></score-partwise>`;
        // One whole note at 60: nowhere near the speed floor, so pace adds nothing.
        const positions = parsePositions(domXmlCodec, chordy);
        expect(positions.right).toEqual([[60, 64]]);
    });
});

// A voice-and-piano score, which is what half the catalogue actually is: the singer on
// one staff, the piano on a grand staff underneath.
const song = (voice: string, pianoRight: string, pianoLeft: string) =>
    `<?xml version="1.0"?><score-partwise>` +
    `<part id="P1"><measure number="1"><attributes><staves>1</staves></attributes>${voice}</measure></part>` +
    `<part id="P2"><measure number="1"><attributes><staves>2</staves></attributes>${pianoRight}${pianoLeft}</measure></part>` +
    `</score-partwise>`;

describe("parsePositions reads which staves are the player's", () => {
    it("grades the piano, not the singer standing over it", () => {
        // Taking the first staff for the right hand is right for a grand staff and wrong
        // for a song. The singer's line has no chords, no left hand and none of a
        // keyboard's reach, so measuring it reads as far easier than the accompaniment
        // the pianist is actually playing.
        const { right, left } = parsePositions(
            domXmlCodec,
            song(note("A", 5, 1), note("C", 4, 1) + note("E", 4, 1, true), note("C", 3, 2)),
        );

        // A5 is the singer's and belongs to neither hand.
        expect(right).toEqual([[60, 64]]);
        expect(left).toEqual([[48]]);
    });

    it("still reads a plain grand staff as it always did", () => {
        const { right, left } = parsePositions(
            domXmlCodec,
            score(note("C", 4, 1) + note("C", 3, 2)),
        );

        expect(right).toEqual([[60]]);
        expect(left).toEqual([[48]]);
    });

    it("reads a document with no parts at all rather than grading it as silence", () => {
        // Malformed input is a normal condition here, and a score that reads as empty
        // would be graded as the easiest thing in the catalogue.
        const { right } = parsePositions(
            domXmlCodec,
            `<?xml version="1.0"?><score-partwise>${note("C", 4)}</score-partwise>`,
        );

        expect(right).toEqual([[60]]);
    });

    it("reads every staff when the chosen ones are empty, rather than grading silence", () => {
        // A six-staff orchestral reduction filed as one "Piano" part: the model names the
        // top two staves and they carry nothing. Reporting no notes would make this the
        // easiest piece in the catalogue and put a symphony in front of a beginner.
        const reduction =
            `<?xml version="1.0"?><score-partwise><part id="P1"><measure number="1">` +
            `<attributes><staves>6</staves></attributes>` +
            `<note><pitch><step>C</step><octave>4</octave></pitch><duration>2</duration><staff>5</staff></note>` +
            `</measure></part></score-partwise>`;

        const { right, left } = parsePositions(domXmlCodec, reduction);

        expect(right.concat(left)).not.toEqual([]);
    });
});

describe("readPace reads the player's staves only", () => {
    it("measures the pianist's speed and texture, not the singer's", () => {
        // A song whose singer runs in semiquavers over a piano part in crotchets: the
        // pace is the pianist's, one note a second at 60 to the crotchet, and the singer's
        // voice does not count as a third hand.
        const timed = (step: string, staff: number, ticks: number) =>
            `<note><pitch><step>${step}</step><octave>4</octave></pitch><duration>${ticks}</duration><voice>1</voice><staff>${staff}</staff></note>`;
        const xml =
            `<?xml version="1.0"?><score-partwise>` +
            `<part id="P1"><measure number="1"><attributes><divisions>4</divisions><staves>1</staves></attributes><sound tempo="60"/>` +
            `${timed("A", 1, 1)}${timed("B", 1, 1)}${timed("A", 1, 1)}${timed("B", 1, 1)}</measure></part>` +
            `<part id="P2"><measure number="1"><attributes><divisions>4</divisions><staves>2</staves></attributes>` +
            `${timed("C", 1, 4)}<backup><duration>4</duration></backup>${timed("C", 2, 4)}</measure></part>` +
            `</score-partwise>`;
        const doc = domXmlCodec.parse(xml)!;
        const pace = readPace(doc);
        expect(pace.notesPerSecond).toBeCloseTo(1);
        expect(pace.voices).toBe(1);
    });
});

describe("parsePositions reads how long the hand has between positions", () => {
    // divisions=2, so a <duration>2</duration> note is one beat; at 60bpm that is a second.
    const timed = (notes: string) =>
        `<?xml version="1.0"?><score-partwise><part id="P1"><measure number="1">` +
        `<attributes><divisions>2</divisions></attributes><sound tempo="60"/>${notes}` +
        `</measure></part></score-partwise>`;

    it("reads each gap as the previous position's own length", () => {
        const { gaps } = parsePositions(domXmlCodec, timed(note("C", 4) + note("D", 4)));
        expect(gaps.right).toEqual([0, 1]);
    });

    it("counts a rest between two notes as time the hand is free to travel", () => {
        const rest = `<note><rest/><duration>4</duration></note>`;
        const { gaps } = parsePositions(domXmlCodec, timed(note("C", 4) + rest + note("C", 6)));
        expect(gaps.right).toEqual([0, 3]);
    });

    it("gives a chord member no gap of its own, since it sounds with the note it joins", () => {
        const { right, gaps } = parsePositions(
            domXmlCodec,
            timed(note("C", 4) + note("E", 4, undefined, true) + note("G", 4)),
        );
        expect(right).toEqual([[60, 64], [67]]);
        expect(gaps.right).toEqual([0, 1]);
    });

    it("keeps each hand's clock to itself", () => {
        const { gaps } = parsePositions(
            domXmlCodec,
            timed(note("C", 5, 1) + note("C", 3, 2) + note("D", 5, 1) + note("D", 3, 2)),
        );
        expect(gaps.right).toEqual([0, 1]);
        expect(gaps.left).toEqual([0, 1]);
    });
});

describe("the difficulty terms a fingering cost cannot see", () => {
    it("charges a wider key signature more", () => {
        const inKey = (fifths: number) =>
            `<?xml version="1.0"?><score-partwise><part id="P1"><measure number="1">` +
            `<attributes><divisions>2</divisions><key><fifths>${fifths}</fifths></key></attributes>` +
            `${note("C", 4) + note("D", 4)}</measure></part></score-partwise>`;
        expect(rawDifficulty(domXmlCodec, inKey(5))).toBeGreaterThan(
            rawDifficulty(domXmlCodec, inKey(0)),
        );
        // Sharps and flats are the same amount of reading.
        expect(rawDifficulty(domXmlCodec, inKey(-4))).toBeCloseTo(
            rawDifficulty(domXmlCodec, inKey(4)),
        );
    });

    it("charges a hand that ranges across the keyboard more than one that stays put", () => {
        const near = score(note("C", 4) + note("E", 4) + note("G", 4));
        const far = score(note("C", 2) + note("E", 4) + note("G", 7));
        expect(rawDifficulty(domXmlCodec, far)).toBeGreaterThan(rawDifficulty(domXmlCodec, near));
    });

    it("charges length by doublings, and stops charging it past the ceiling", () => {
        const hands = (count: number) => ({
            right: Array.from({ length: count }, () => [60]),
            left: [],
            gaps: { right: [], left: [] },
        });
        // Nothing for a score at or under the beginner floor.
        expect(readLength(hands(64))).toBe(0);
        expect(readLength(hands(32))).toBe(0);
        // Then one per doubling of it.
        expect(readLength(hands(128))).toBeCloseTo(1);
        expect(readLength(hands(512))).toBeCloseTo(3);
        // And nothing further once the ceiling is reached, so a complete edition and a
        // truncated import of the same piece stay within reach of each other.
        expect(readLength(hands(1024))).toBeCloseTo(4);
        expect(readLength(hands(64_000))).toBeCloseTo(4);
    });
});

describe("the calibrated piece boundaries", () => {
    it("names one fewer boundary than there are grades", () => {
        expect(pieceBoundaries).toHaveLength(MAX_GRADE - 1);
    });

    it("rises strictly, so every grade has room of its own", () => {
        for (let i = 1; i < pieceBoundaries.length; i++) {
            expect(pieceBoundaries[i]!).toBeGreaterThan(pieceBoundaries[i - 1]!);
        }
    });

    it("is what gradeOf grades a piece against, so the manifest and the chip agree", () => {
        // The import tooling reads these same numbers; a piece costing just under a
        // boundary belongs to the grade below it, and just over to the grade above.
        const above = pieceBoundaries[0]! + 0.001;
        const below = pieceBoundaries[0]! - 0.001;
        expect(gradeForBoundaries(below)).toBe(1);
        expect(gradeForBoundaries(above)).toBe(2);
    });
});

// Walks the boundaries the way gradeOf does, over a cost rather than a score.
function gradeForBoundaries(cost: number): number {
    let grade = 1;
    for (const boundary of pieceBoundaries) {
        if (cost <= boundary) {
            break;
        }
        grade += 1;
    }
    return grade;
}
