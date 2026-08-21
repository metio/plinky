// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { OpenSheetMusicDisplay } from "opensheetmusicdisplay";
import { afterEach, describe, expect, it } from "vitest";
import { readDirections, readFifths, slurSpans } from "../../core/musicxmlMarks";
import { performanceOrder, readMeasureRepeats } from "../../core/musicxmlRepeats";
import { readTimeline } from "../../core/musicxmlTimeline";
import {
    readKeyFifths,
    readOctaveShiftSpans,
    readOrnament,
    readPedalSpans,
    readSlurSpans,
} from "./scoreExpression";

// Does reading the file agree with reading the engraver?
//
// The engraver is being retired from the job of telling us what the music is — it is a
// display widget, and every musical fact taken out of its object graph has been a guess
// confirmable only by loading a real score in a real browser. `core/musicxmlTimeline.ts`
// reads the same facts out of the document, in a node process, from a specification.
//
// This is the test that lets that swap happen safely: the same scores through both, and
// the onsets and pitches must match. It is the only place the two are compared, and it is
// deliberately here in a browser rather than in node, because half of the comparison is
// the engraver itself.

const ATTR = (divisions = 4) =>
    `<attributes><divisions>${divisions}</divisions><key><fifths>0</fifths></key><time><beats>4</beats><beat-type>4</beat-type></time><clef><sign>G</sign><line>2</line></clef></attributes>`;

const note = (step: string, octave: number, ticks: number, extra = "") =>
    `<note>${extra}<pitch><step>${step}</step><octave>${octave}</octave></pitch><duration>${ticks}</duration><voice>1</voice></note>`;

const rest = (ticks: number) => `<note><rest/><duration>${ticks}</duration><voice>1</voice></note>`;

const score = (measures: string) => `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="3.1">
  <part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list>
  <part id="P1">${measures}</part></score-partwise>`;

// The shapes real engravings are made of, rather than one note after another: a chord, a
// second voice written after the first behind a backup, ties, a rest, and a change of
// divisions mid-piece.
const CASES: { name: string; xml: string }[] = [
    {
        name: "a plain line of crotchets",
        xml: score(
            `<measure number="1">${ATTR()}${note("C", 4, 4)}${note("D", 4, 4)}${note("E", 4, 4)}${note("F", 4, 4)}</measure>`,
        ),
    },
    {
        name: "chords",
        xml: score(
            `<measure number="1">${ATTR()}${note("C", 4, 8)}${note("E", 4, 8, "<chord/>")}${note("G", 4, 8, "<chord/>")}${note("D", 4, 8)}${note("F", 4, 8, "<chord/>")}</measure>`,
        ),
    },
    {
        name: "rests among the notes",
        xml: score(
            `<measure number="1">${ATTR()}${note("C", 4, 4)}${rest(4)}${note("E", 4, 4)}${rest(4)}</measure>`,
        ),
    },
    {
        name: "two hands, the second written behind a backup",
        xml: score(
            `<measure number="1"><attributes><divisions>4</divisions><key><fifths>0</fifths></key><time><beats>4</beats><beat-type>4</beat-type></time><staves>2</staves><clef number="1"><sign>G</sign><line>2</line></clef><clef number="2"><sign>F</sign><line>4</line></clef></attributes>` +
                `<note><pitch><step>C</step><octave>5</octave></pitch><duration>8</duration><voice>1</voice><staff>1</staff></note>` +
                `<note><pitch><step>D</step><octave>5</octave></pitch><duration>8</duration><voice>1</voice><staff>1</staff></note>` +
                `<backup><duration>16</duration></backup>` +
                `<note><pitch><step>C</step><octave>3</octave></pitch><duration>16</duration><voice>2</voice><staff>2</staff></note>` +
                `</measure>`,
        ),
    },
    {
        name: "a tie across the barline",
        xml: score(
            `<measure number="1">${ATTR()}${note("C", 4, 16, '<tie type="start"/>')}</measure>` +
                `<measure number="2">${note("C", 4, 16, '<tie type="stop"/>')}</measure>`,
        ),
    },
    {
        name: "a change of divisions mid-piece",
        xml: score(
            `<measure number="1">${ATTR(4)}${note("C", 4, 16)}</measure>` +
                `<measure number="2"><attributes><divisions>8</divisions></attributes>${note("D", 4, 16)}</measure>`,
        ),
    },
    {
        name: "several measures of mixed lengths",
        xml: score(
            `<measure number="1">${ATTR()}${note("C", 4, 8)}${note("D", 4, 4)}${note("E", 4, 4)}</measure>` +
                `<measure number="2">${note("F", 4, 16)}</measure>` +
                `<measure number="3">${note("G", 4, 2)}${note("A", 4, 2)}${note("B", 4, 4)}${note("C", 5, 8)}</measure>`,
        ),
    },
];

let host: HTMLDivElement | null = null;

function load(xml: string): Promise<OpenSheetMusicDisplay> {
    host = document.createElement("div");
    host.style.width = "800px";
    document.body.appendChild(host);
    const osmd = new OpenSheetMusicDisplay(host, { drawingParameters: "compact" });
    return osmd.load(xml).then(() => {
        osmd.render();
        return osmd;
    });
}

// What the engraver says: each cursor position's onset and the pitches sounding there.
function throughOsmd(osmd: OpenSheetMusicDisplay): [number, number[]][] {
    const cursor = osmd.cursor;
    cursor.reset();
    const found: [number, number[]][] = [];
    while (!cursor.iterator.EndReached) {
        const whole = cursor.iterator.currentTimeStamp?.RealValue ?? 0;
        const pitches = cursor
            .NotesUnderCursor()
            .filter((one) => !one.isRest() && one.halfTone > 0)
            .map((one) => one.halfTone + 12)
            .sort((a, b) => a - b);
        if (pitches.length > 0) {
            found.push([round(whole), pitches]);
        }
        cursor.next();
    }
    cursor.reset();
    return found;
}

// The same, read from the document. A tie's later notes are dropped on both sides: the
// engraver's cursor stops on them and ours reports them, and neither is a fresh strike.
function throughFile(xml: string): [number, number[]][] {
    const doc = new DOMParser().parseFromString(xml, "application/xml");
    const byOnset = new Map<number, number[]>();
    for (const one of readTimeline(doc).notes) {
        if (one.midi === null || one.grace) {
            continue;
        }
        const key = round(one.whole);
        byOnset.set(key, [...(byOnset.get(key) ?? []), one.midi]);
    }
    return [...byOnset.entries()]
        .sort((one, other) => one[0] - other[0])
        .map(
            ([whole, pitches]) => [whole, [...pitches].sort((a, b) => a - b)] as [number, number[]],
        );
}

const round = (value: number) => Math.round(value * 10000) / 10000;

afterEach(() => {
    host?.remove();
    host = null;
});

describe("the file and the engraver agree about the music", () => {
    for (const one of CASES) {
        it(`reads the same onsets and pitches for ${one.name}`, () => {
            return load(one.xml).then((osmd) => {
                expect(throughFile(one.xml)).toEqual(throughOsmd(osmd));
            });
        });
    }
});

// The marks, both ways. These are the readings being retired, so each one is compared
// against the engraver on the shape that produced it.
describe("the file and the engraver agree about the marks", () => {
    it("finds the same arches", () => {
        const xml = score(
            `<measure number="1">${ATTR()}` +
                `<note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration><notations><slur number="1" type="start"/></notations></note>` +
                `<note><pitch><step>D</step><octave>4</octave></pitch><duration>4</duration></note>` +
                `<note><pitch><step>E</step><octave>4</octave></pitch><duration>4</duration><notations><slur number="1" type="stop"/></notations></note>` +
                `<note><pitch><step>F</step><octave>4</octave></pitch><duration>4</duration></note>` +
                `</measure>`,
        );
        return load(xml).then((osmd) => {
            const doc = new DOMParser().parseFromString(xml, "application/xml");
            expect(slurSpans(readTimeline(doc).notes)).toEqual(readSlurSpans(osmd));
        });
    });

    it("finds the same pedal spans", () => {
        const xml = score(
            `<measure number="1">${ATTR()}` +
                `<direction><direction-type><pedal type="start" line="yes"/></direction-type></direction>` +
                note("C", 4, 8) +
                note("D", 4, 8) +
                `<direction><direction-type><pedal type="stop" line="yes"/></direction-type></direction>` +
                `</measure>`,
        );
        return load(xml).then((osmd) => {
            const doc = new DOMParser().parseFromString(xml, "application/xml");
            const timeline = readTimeline(doc);
            expect(readDirections(doc, timeline).pedals).toEqual(readPedalSpans(osmd));
        });
    });

    it("finds the same octave lines", () => {
        const xml = score(
            `<measure number="1">${ATTR()}` +
                `<direction><direction-type><octave-shift type="up" size="8"/></direction-type></direction>` +
                note("C", 5, 8) +
                note("D", 5, 8) +
                `<direction><direction-type><octave-shift type="stop" size="8"/></direction-type></direction>` +
                `</measure>`,
        );
        return load(xml).then((osmd) => {
            const doc = new DOMParser().parseFromString(xml, "application/xml");
            const timeline = readTimeline(doc);
            const mine = readDirections(doc, timeline).octaveShifts;
            const theirs = readOctaveShiftSpans(osmd);
            expect(mine.map((one) => one.semitones)).toEqual(theirs.map((one) => one.semitones));
            expect(mine.map((one) => one.from)).toEqual(theirs.map((one) => one.from));
        });
    });

    it("reads the same key signature", () => {
        const xml = score(
            `<measure number="1"><attributes><divisions>4</divisions><key><fifths>-3</fifths></key><time><beats>4</beats><beat-type>4</beat-type></time><clef><sign>G</sign><line>2</line></clef></attributes>${note("C", 4, 16)}</measure>`,
        );
        return load(xml).then((osmd) => {
            const doc = new DOMParser().parseFromString(xml, "application/xml");
            expect(readFifths(doc)).toBe(readKeyFifths(osmd));
        });
    });

    it("recognises the same little signs over the same notes", () => {
        const ornamented = (kind: string) =>
            `<note><pitch><step>C</step><octave>5</octave></pitch><duration>4</duration><notations><ornaments><${kind}/></ornaments></notations></note>`;
        const xml = score(
            `<measure number="1">${ATTR()}${ornamented("trill-mark")}${ornamented("mordent")}${ornamented("turn")}${note("D", 5, 4)}</measure>`,
        );
        return load(xml).then((osmd) => {
            const doc = new DOMParser().parseFromString(xml, "application/xml");
            const mine = readTimeline(doc).notes.map((one) => one.marks.ornament);
            const cursor = osmd.cursor;
            cursor.reset();
            const theirs: (string | null)[] = [];
            while (!cursor.iterator.EndReached) {
                theirs.push(readOrnament(cursor.NotesUnderCursor()[0]));
                cursor.next();
            }
            cursor.reset();
            expect(mine).toEqual(theirs);
        });
    });
});

describe("the file and the engraver agree about the order the music is played in", () => {
    const whole = (step: string) =>
        `<note><pitch><step>${step}</step><octave>4</octave></pitch><duration>4</duration><type>whole</type></note>`;
    const OPEN = `<attributes><divisions>1</divisions><key><fifths>0</fifths></key><time><beats>4</beats><beat-type>4</beat-type></time><clef><sign>G</sign><line>2</line></clef></attributes>`;

    // Pitches in performance order, from the file: the measures in the order they are
    // played, each contributing its printed notes.
    function playedThroughFile(xml: string): number[] {
        const doc = new DOMParser().parseFromString(xml, "application/xml");
        const timeline = readTimeline(doc);
        return performanceOrder(readMeasureRepeats(doc)).flatMap((measure) =>
            timeline.notes
                .filter((one) => one.measure === measure && one.midi !== null && !one.grace)
                .map((one) => one.midi as number),
        );
    }

    const playedThroughOsmd = (osmd: OpenSheetMusicDisplay) =>
        throughOsmd(osmd).flatMap(([, pitches]) => pitches);

    it("takes a repeated section twice, exactly as the engraver walks it", () => {
        const xml = score(
            `<measure number="1">${OPEN}<barline location="left"><repeat direction="forward"/></barline>${whole("C")}</measure>` +
                `<measure number="2">${whole("D")}<barline location="right"><repeat direction="backward"/></barline></measure>` +
                `<measure number="3">${whole("E")}</measure>`,
        );
        return load(xml).then((osmd) => {
            expect(playedThroughFile(xml)).toEqual(playedThroughOsmd(osmd));
            // …and that is the C D C D E the engraver's own test pins.
            expect(playedThroughFile(xml)).toEqual([60, 62, 60, 62, 64]);
        });
    });

    it("plays the first-time bar once and the second-time bar once", () => {
        const xml = score(
            `<measure number="1">${OPEN}<barline location="left"><repeat direction="forward"/></barline>${whole("C")}</measure>` +
                `<measure number="2">${whole("D")}</measure>` +
                `<measure number="3"><barline location="left"><ending number="1" type="start"/></barline>${whole("E")}<barline location="right"><ending number="1" type="stop"/><repeat direction="backward"/></barline></measure>` +
                `<measure number="4"><barline location="left"><ending number="2" type="start"/></barline>${whole("F")}</measure>`,
        );
        return load(xml).then((osmd) => {
            expect(playedThroughFile(xml)).toEqual(playedThroughOsmd(osmd));
        });
    });

    it("plays a piece with no repeats straight through, both ways", () => {
        const xml = score(
            `<measure number="1">${OPEN}${whole("C")}</measure><measure number="2">${whole("D")}</measure>`,
        );
        return load(xml).then((osmd) => {
            expect(playedThroughFile(xml)).toEqual(playedThroughOsmd(osmd));
        });
    });
});
