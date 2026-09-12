// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import { domXmlCodec } from "../app/adapters/domXmlCodec";
import { describe, expect, it } from "vitest";
import {
    fifthsAt,
    NO_SCORE_MARKS,
    readDirections,
    readFifths,
    readScoreMarks,
    readTempoPoints,
    slurSpans,
    tempoAt,
    transposeScoreMarks,
} from "./musicxmlMarks";
import { readTimeline } from "./musicxmlTimeline";
import { pedalledAt } from "./pedal";
import { slurredOnwardAt } from "./slur";
import { transposeMusicXml } from "./transpose";

const parse = (xml: string): Document => new DOMParser().parseFromString(xml, "application/xml");

const score = (measures: string, fifths = 0) =>
    parse(`<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="3.1"><part-list><score-part id="P1"><part-name>P</part-name></score-part></part-list>
<part id="P1">${measures.replace("FIFTHS", String(fifths))}</part></score-partwise>`);

const ATTR = `<attributes><divisions>4</divisions><key><fifths>FIFTHS</fifths></key><time><beats>4</beats><beat-type>4</beat-type></time></attributes>`;

const note = (step: string, ticks: number, extra = "") =>
    `<note>${extra}<pitch><step>${step}</step><octave>4</octave></pitch><duration>${ticks}</duration></note>`;

const direction = (inner: string) =>
    `<direction><direction-type>${inner}</direction-type></direction>`;

const read = (measures: string, fifths = 0) => {
    const doc = score(measures, fifths);
    const timeline = readTimeline(doc);
    return { doc, timeline, ...readDirections(timeline) };
};

describe("the marks that cover a stretch of music", () => {
    it("pairs an arch from its start note to its last", () => {
        const { timeline } = read(
            `<measure number="1">${ATTR}${note("C", 4, '<notations><slur number="1" type="start"/></notations>')}${note("D", 4)}${note("E", 4, '<notations><slur number="1" type="stop"/></notations>')}${note("F", 4)}</measure>`,
        );
        const spans = slurSpans(timeline.notes);
        expect(spans).toEqual([{ from: 0, to: 0.5, staff: 0 }]);
        // Every note under the arch is joined onward except its last.
        expect([0, 0.25, 0.5, 0.75].map((at) => slurredOnwardAt(spans, at))).toEqual([
            true,
            true,
            false,
            false,
        ]);
    });

    it("keeps two overlapping arches apart by their numbers", () => {
        // One per hand, or a phrase inside a phrase. Paired by order rather than by number
        // they would close each other and both come out wrong.
        const { timeline } = read(
            `<measure number="1">${ATTR}${note("C", 4, '<notations><slur number="1" type="start"/></notations>')}${note("D", 4, '<notations><slur number="2" type="start"/></notations>')}${note("E", 4, '<notations><slur number="1" type="stop"/></notations>')}${note("F", 4, '<notations><slur number="2" type="stop"/></notations>')}</measure>`,
        );
        expect(slurSpans(timeline.notes)).toEqual([
            { from: 0, to: 0.5, staff: 0 },
            { from: 0.25, to: 0.75, staff: 0 },
        ]);
    });

    it("runs an arch nobody closed to the last note it opened over", () => {
        const { timeline } = read(
            `<measure number="1">${ATTR}${note("C", 4, '<notations><slur number="1" type="start"/></notations>')}${note("D", 4)}</measure>`,
        );
        expect(slurSpans(timeline.notes)).toEqual([{ from: 0, to: 0.25, staff: 0 }]);
    });

    it("reads each written dynamic as a loudness at the place it is written", () => {
        const { dynamics } = read(
            `<measure number="1">${ATTR}${direction("<dynamics><mf/></dynamics>")}${note("C", 8)}${direction("<dynamics><ff/></dynamics>")}${note("D", 8)}</measure>`,
        );
        expect(dynamics.map((one) => [one.whole, one.volume])).toEqual([
            [0, 80],
            [0.5, 112],
        ]);
    });

    it("marks a hairpin as a slide rather than a step", () => {
        const { dynamics } = read(
            `<measure number="1">${ATTR}${direction('<wedge type="crescendo"/>')}${note("C", 16)}</measure>`,
        );
        expect(dynamics[0]?.ramp).toBe(true);
    });

    it("starts a hairpin from the loudness already in force", () => {
        // A hairpin does not say how loud anything is; it says the loudness changes from
        // here. Carrying no loudness of its own made every note under one silent — the
        // arithmetic downstream multiplies through it.
        const { dynamics } = read(
            `<measure number="1">${ATTR}${direction("<dynamics><pp/></dynamics>")}${note("C", 8)}${direction('<wedge type="crescendo"/>')}${note("D", 8)}</measure>`,
        );
        expect(dynamics[1]).toMatchObject({ ramp: true, volume: dynamics[0]?.volume });
        expect(Number.isFinite(dynamics[1]?.volume)).toBe(true);
    });

    it("gives a hairpin with nothing before it somewhere to start from", () => {
        const { dynamics } = read(
            `<measure number="1">${ATTR}${direction('<wedge type="crescendo"/>')}${note("C", 16)}</measure>`,
        );
        expect(Number.isFinite(dynamics[0]?.volume)).toBe(true);
        expect(dynamics[0]?.volume).toBeGreaterThan(0);
    });

    it("reads the pedal down and up", () => {
        const { pedals } = read(
            `<measure number="1">${ATTR}${direction('<pedal type="start"/>')}${note("C", 8)}${note("D", 8)}${direction('<pedal type="stop"/>')}</measure>`,
        );
        expect(pedals).toEqual([{ from: 0, to: 1, kind: "sustain" }]);
        expect(pedalledAt(pedals, 0.5)).toBe(true);
        expect(pedalledAt(pedals, 1)).toBe(false);
    });

    it("treats a pedal change as a lift and a press on the spot", () => {
        // What clears the old harmony. Read as a plain start it would pool the whole
        // passage into one wash.
        const { pedals } = read(
            `<measure number="1">${ATTR}${direction('<pedal type="start"/>')}${note("C", 8)}${direction('<pedal type="change"/>')}${note("D", 8)}${direction('<pedal type="stop"/>')}</measure>`,
        );
        expect(pedals).toEqual([
            { from: 0, to: 0.5, kind: "sustain" },
            { from: 0.5, to: 1, kind: "sustain" },
        ]);
    });

    it("carries a pedal nobody lifted to the end of the music", () => {
        const { pedals } = read(
            `<measure number="1">${ATTR}${direction('<pedal type="start"/>')}${note("C", 16)}</measure>`,
        );
        expect(pedals).toHaveLength(1);
        expect(pedals[0]?.to).toBeGreaterThanOrEqual(pedals[0]?.from ?? 0);
    });

    it("keeps a slur to the staff it is drawn on, numbered as the engraver numbers staves", () => {
        // A right-hand arch over a left hand of staccato quarters: the bass is not slurred.
        // Staves are 1 and 2 in the file and 0 and 1 to the engraver.
        const right = (step: string, extra = "") =>
            `<note><pitch><step>${step}</step><octave>5</octave></pitch><duration>4</duration><voice>1</voice><type>quarter</type><staff>1</staff>${extra}</note>`;
        const left = (step: string) =>
            `<note><pitch><step>${step}</step><octave>3</octave></pitch><duration>4</duration><voice>5</voice><type>quarter</type><staff>2</staff><notations><articulations><staccato/></articulations></notations></note>`;
        const timeline = readTimeline(
            score(
                `<measure number="1"><attributes><divisions>4</divisions><staves>2</staves><clef number="1"><sign>G</sign><line>2</line></clef><clef number="2"><sign>F</sign><line>4</line></clef></attributes>${right("C", '<notations><slur number="1" type="start"/></notations>')}${right("D")}${right("E", '<notations><slur number="1" type="stop"/></notations>')}${right("F")}<backup><duration>16</duration></backup>${left("C")}${left("G")}${left("G")}${left("C")}</measure>`,
            ),
        );
        const spans = slurSpans(timeline.notes);
        expect(spans).toEqual([{ from: 0, to: 0.5, staff: 0 }]);
        expect(slurredOnwardAt(spans, 0.25, 0)).toBe(true);
        expect(slurredOnwardAt(spans, 0.25, 1)).toBe(false);
    });

    it("reads the key signature, and calls a score without one C major", () => {
        expect(readFifths(score(`<measure number="1">${ATTR}</measure>`, 3))).toBe(3);
        expect(readFifths(score(`<measure number="1">${ATTR}</measure>`, -3))).toBe(-3);
        expect(readFifths(parse("<nonsense/>"))).toBe(0);
    });

    it("places a direction where the measure's cursor had reached, not at its barline", () => {
        // A direction sits between the notes it applies from. Placing them all at the
        // barline would make every dynamic in the piece arrive early.
        const { dynamics } = read(
            `<measure number="1">${ATTR}${note("C", 4)}${note("D", 4)}${direction("<dynamics><f/></dynamics>")}${note("E", 4)}</measure>`,
        );
        expect(dynamics[0]?.whole).toBe(0.5);
    });

    it("answers a document with no marks with empty lists rather than throwing", () => {
        const { dynamics, pedals } = read(`<measure number="1">${ATTR}${note("C", 16)}</measure>`);
        expect({ dynamics, pedals }).toEqual({ dynamics: [], pedals: [] });
    });
});

describe("where the piece changes speed", () => {
    it("reads a tempo where it is written, not at the barline before it", () => {
        // The engraver resolved a tempo onto the bar the mark sat in, so a mark written
        // mid-bar took effect early — by up to a whole bar. Thirteen files in a hundred in
        // the catalogue write one.
        const { timeline } = read(
            `<measure number="1">${ATTR}${note("C", 8)}<sound tempo="60"/>${note("D", 8)}</measure>`,
        );
        expect(readTempoPoints(timeline)).toEqual([{ whole: 0.5, bpm: 60 }]);
    });

    it("reads a tempo written inside a direction as well as one standing alone", () => {
        const { timeline } = read(
            `<measure number="1">${ATTR}<direction><direction-type><words>Allegro</words></direction-type><sound tempo="132"/></direction>${note("C", 16)}</measure>`,
        );
        expect(readTempoPoints(timeline)).toEqual([{ whole: 0, bpm: 132 }]);
    });

    it("says a metronome mark in crotchets, whatever note it counts", () => {
        // A dotted crotchet at 60 in six-eight is ninety crotchets a minute; read as sixty
        // the piece plays at two thirds of its speed.
        const dotted = read(
            `<measure number="1">${ATTR}${direction("<metronome><beat-unit>quarter</beat-unit><beat-unit-dot/><per-minute>60</per-minute></metronome>")}${note("C", 16)}</measure>`,
        );
        expect(readTempoPoints(dotted.timeline)[0]?.bpm).toBe(90);

        const minim = read(
            `<measure number="1">${ATTR}${direction("<metronome><beat-unit>half</beat-unit><per-minute>60</per-minute></metronome>")}${note("C", 16)}</measure>`,
        );
        expect(readTempoPoints(minim.timeline)[0]?.bpm).toBe(120);
    });

    it("prefers the sounding instruction to the printed one where a score writes both", () => {
        const { timeline } = read(
            `<measure number="1">${ATTR}<direction><direction-type><metronome><beat-unit>quarter</beat-unit><per-minute>200</per-minute></metronome></direction-type><sound tempo="100"/></direction>${note("C", 16)}</measure>`,
        );
        expect(readTempoPoints(timeline)[0]?.bpm).toBe(100);
    });

    it("carries a tempo forward until the next one", () => {
        const points = [
            { whole: 0, bpm: 120 },
            { whole: 2, bpm: 60 },
        ];
        expect(tempoAt(points, 0)).toBe(120);
        expect(tempoAt(points, 1.9)).toBe(120);
        expect(tempoAt(points, 2)).toBe(60);
        expect(tempoAt(points, 99)).toBe(60);
    });

    it("says nothing for a piece that has stated no tempo yet", () => {
        expect(tempoAt([], 0)).toBeNull();
        expect(tempoAt([{ whole: 1, bpm: 90 }], 0)).toBeNull();
    });
});

describe("fifthsAt", () => {
    const keys = [
        { whole: 0, fifths: 0 },
        { whole: 4, fifths: 3 },
        { whole: 12, fifths: -2 },
    ];

    it("answers the key in force, not the one the piece opened in", () => {
        expect(fifthsAt(keys, 0)).toBe(0);
        expect(fifthsAt(keys, 3.9)).toBe(0);
        expect(fifthsAt(keys, 4)).toBe(3);
        expect(fifthsAt(keys, 11)).toBe(3);
        expect(fifthsAt(keys, 12)).toBe(-2);
        expect(fifthsAt(keys, 100)).toBe(-2);
    });

    it("takes effect at the barline, not a hair after it", () => {
        // Onsets are summed in whole notes and land on a barline by arithmetic that can
        // leave a floating-point crumb behind. A change that missed its own downbeat would
        // spell the first ornament of the new key out of the old one.
        //
        // A crumb, and only a crumb: the tolerance is 1e-9, the same one the dynamics and
        // the tempo use. Anything larger is a real offset — a note genuinely before the
        // barline — and it belongs to the key that is still in force there.
        expect(fifthsAt(keys, 4 - 1e-12)).toBe(3);
        expect(fifthsAt(keys, 4 - 1 / 4096)).toBe(0);
    });

    it("is C major where the piece states no key at all", () => {
        expect(fifthsAt([], 7)).toBe(0);
    });
});

describe("transposeScoreMarks", () => {
    // A bar that shakes a C-E third against a G-B one, then glides from D up to A.
    const trem = (step: string, type: string, chord = false) =>
        `<note>${chord ? "<chord/>" : ""}<pitch><step>${step}</step><octave>4</octave></pitch><duration>4</duration><notations><ornaments><tremolo type="${type}">2</tremolo></ornaments></notations></note>`;
    const gliss = (step: string, type: string) =>
        `<note><pitch><step>${step}</step><octave>4</octave></pitch><duration>4</duration><notations><glissando type="${type}"/></notations></note>`;
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="3.1"><part-list><score-part id="P1"><part-name>P</part-name></score-part></part-list>
<part id="P1"><measure number="1">${ATTR.replace("FIFTHS", "0")}${trem("C", "start")}${trem("E", "start", true)}${trem("G", "stop")}${trem("B", "stop", true)}${gliss("D", "start")}${gliss("A", "stop")}</measure></part></score-partwise>`;

    it("puts a tremolo's chords and a glissando's ends in the key being played", () => {
        const moved = transposeScoreMarks(readScoreMarks(parse(xml)), 3);
        // What the same marks read off a score transposed on the page: the notes the
        // engraver hands Listen are these, so the figure must be built from them.
        const page = readScoreMarks(parse(transposeMusicXml(domXmlCodec, xml, 3)));
        expect(moved.tremolos).toEqual(page.tremolos);
        expect(moved.glissandos).toEqual(page.glissandos);
        expect(moved.tremolos[0]?.pair?.map((chord) => chord.pitches)).toEqual([
            [63, 67],
            [70, 74],
        ]);
        expect(moved.glissandos[0]).toMatchObject({ pitch: 65, arrivesAt: 72 });
    });

    it("moves every key the piece passes through", () => {
        const moved = transposeScoreMarks(readScoreMarks(parse(xml)), 2);
        expect(moved.fifths).toBe(2);
        expect(moved.keys.map((point) => point.fifths)).toEqual([2]);
    });

    it("names the keys the transposed page prints", () => {
        // A bar in the opening key, then one after a change of signature.
        const modulating = (
            opening: number,
            later: number,
        ) => `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="3.1"><part-list><score-part id="P1"><part-name>P</part-name></score-part></part-list>
<part id="P1"><measure number="1">${ATTR.replace("FIFTHS", String(opening))}${note("C", 16)}</measure><measure number="2"><attributes><key><fifths>${later}</fifths></key></attributes>${note("C", 16)}</measure></part></score-partwise>`;
        // D major up a major seventh; C major into D♭ up a semitone; F♯ major down one.
        const cases: Array<[number, number, number]> = [
            [2, 2, 11],
            [0, -5, 1],
            [6, 6, -1],
            [-3, 4, 6],
            [0, 3, -7],
        ];
        for (const [opening, later, semitones] of cases) {
            const xml = modulating(opening, later);
            const moved = transposeScoreMarks(readScoreMarks(parse(xml)), semitones);
            const page = readScoreMarks(parse(transposeMusicXml(domXmlCodec, xml, semitones)));
            expect(moved.fifths).toBe(page.fifths);
            expect(moved.keys).toEqual(page.keys);
        }
    });

    it("leaves a piece nobody transposed exactly as the file wrote it", () => {
        const read = readScoreMarks(parse(xml));
        expect(transposeScoreMarks(read, 0)).toBe(read);
    });

    it("keeps a glissando that names no starting pitch without inventing one", () => {
        const moved = transposeScoreMarks(
            { ...NO_SCORE_MARKS, glissandos: [{ from: 0, to: 1, arrivesAt: 60 }] },
            -5,
        );
        expect(moved.glissandos).toEqual([{ from: 0, to: 1, arrivesAt: 55 }]);
    });
});

// A score written for more than one part: an art song [voice, piano on two staves], a piano
// written as two single-staff parts, and two singers above a piano.
const ONE_STAFF = `<attributes><divisions>4</divisions><key><fifths>0</fifths></key><time><beats>4</beats><beat-type>4</beat-type></time><clef><sign>G</sign><line>2</line></clef></attributes>`;
const TWO_STAVES = `<attributes><divisions>4</divisions><key><fifths>0</fifths></key><time><beats>4</beats><beat-type>4</beat-type></time><staves>2</staves><clef number="1"><sign>G</sign><line>2</line></clef><clef number="2"><sign>F</sign><line>4</line></clef></attributes>`;

// A crotchet on a staff and voice, with whatever notations it carries.
const quarter = (step: string, octave: number, staff = 1, voice = "1", notations = "") =>
    `<note><pitch><step>${step}</step><octave>${octave}</octave></pitch><duration>4</duration><voice>${voice}</voice><type>quarter</type><staff>${staff}</staff>${
        notations ? `<notations>${notations}</notations>` : ""
    }</note>`;

const BACK = "<backup><duration>16</duration></backup>";

const partwise = (parts: { id: string; body: string }[]) =>
    parse(`<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="3.1"><part-list>${parts
        .map((one) => `<score-part id="${one.id}"><part-name>${one.id}</part-name></score-part>`)
        .join("")}</part-list>${parts
        .map((one) => `<part id="${one.id}"><measure number="1">${one.body}</measure></part>`)
        .join("")}</score-partwise>`);

// The singer: four plain crotchets, unslurred.
const SINGER = `${ONE_STAFF}${quarter("G", 4)}${quarter("A", 4)}${quarter("B", 4)}${quarter("D", 4)}`;
// The piano: a right-hand arch over three notes, and a staccato left hand under it.
const SLURRED_PIANO = `${TWO_STAVES}${quarter("C", 5, 1, "1", '<slur number="1" type="start"/>')}${quarter("D", 5)}${quarter("E", 5, 1, "1", '<slur number="1" type="stop"/>')}${quarter("F", 5)}${BACK}${["C", "G", "G", "C"].map((step) => quarter(step, 3, 2, "5", "<articulations><staccato/></articulations>")).join("")}`;

describe("a score written for more than one part", () => {
    it("numbers an art song's arches the way the page without the singer numbers its staves", () => {
        const doc = partwise([
            { id: "P1", body: SINGER },
            { id: "P2", body: SLURRED_PIANO },
        ]);
        // With the singer taken off the page the piano's right hand is staff 0.
        const spans = readScoreMarks(doc, { accompaniment: false }).slurs;
        expect(spans).toEqual([{ from: 0, to: 0.5, staff: 0 }]);
        expect(slurredOnwardAt(spans, 0.25, 0)).toBe(true);
        expect(slurredOnwardAt(spans, 0.25, 1)).toBe(false);
    });

    it("numbers them across the whole score where the singer is drawn too", () => {
        const doc = partwise([
            { id: "P1", body: SINGER },
            { id: "P2", body: SLURRED_PIANO },
        ]);
        expect(readScoreMarks(doc, { accompaniment: true }).slurs).toEqual([
            { from: 0, to: 0.5, staff: 1 },
        ]);
        // What a caller that engraves the file as it is gets without asking.
        expect(readScoreMarks(doc).slurs).toEqual([{ from: 0, to: 0.5, staff: 1 }]);
    });

    it("numbers them past two singers, drawn or not", () => {
        const doc = partwise([
            { id: "S", body: SINGER },
            { id: "A", body: SINGER },
            { id: "P", body: SLURRED_PIANO },
        ]);
        expect(readScoreMarks(doc, { accompaniment: false }).slurs).toEqual([
            { from: 0, to: 0.5, staff: 0 },
        ]);
        expect(readScoreMarks(doc, { accompaniment: true }).slurs).toEqual([
            { from: 0, to: 0.5, staff: 2 },
        ]);
    });

    it("keeps a singer's arch off the page it is not drawn on", () => {
        const slurredSinger = `${ONE_STAFF}${quarter("G", 4, 1, "1", '<slur number="1" type="start"/>')}${quarter("A", 4, 1, "1", '<slur number="1" type="stop"/>')}${quarter("B", 4)}${quarter("C", 5)}`;
        const doc = partwise([
            { id: "P1", body: slurredSinger },
            {
                id: "P2",
                body: `${TWO_STAVES}${quarter("C", 5)}${quarter("D", 5)}${quarter("E", 5)}${quarter("F", 5)}`,
            },
        ]);
        expect(readScoreMarks(doc, { accompaniment: false }).slurs).toEqual([]);
        expect(readScoreMarks(doc, { accompaniment: true }).slurs).toEqual([
            { from: 0, to: 0.25, staff: 0 },
        ]);
    });
    it("rocks only the part that carries a tremolo, not the other single-staff hand", () => {
        // A piano written as two parts of one staff each: both hands are staff 1, voice 1,
        // in their own part.
        const tremolo = '<tremolo type="single">3</tremolo>';
        const doc = partwise([
            {
                id: "RH",
                body: `${ONE_STAFF}<note><pitch><step>C</step><octave>5</octave></pitch><duration>16</duration><voice>1</voice><type>whole</type><notations><ornaments>${tremolo}</ornaments></notations></note>`,
            },
            {
                id: "LH",
                body: `${ONE_STAFF}<note><pitch><step>C</step><octave>3</octave></pitch><duration>16</duration><voice>1</voice><type>whole</type></note>`,
            },
        ]);
        expect(readScoreMarks(doc).tremolos.map((span) => span.pitches)).toEqual([[72]]);
    });

    it("rocks only the piano's note under a tremolo, not the singer's at the same onset", () => {
        const tremolo = '<ornaments><tremolo type="single">3</tremolo></ornaments>';
        const doc = partwise([
            { id: "P1", body: SINGER },
            {
                id: "P2",
                body: `${TWO_STAVES}${quarter("C", 5, 1, "1", tremolo)}${quarter("D", 5)}${quarter("E", 5)}${quarter("F", 5)}`,
            },
        ]);
        for (const accompaniment of [false, true]) {
            expect(
                readScoreMarks(doc, { accompaniment }).tremolos.map((span) => span.pitches),
            ).toEqual([[72]]);
        }
    });

    it("ends a glissando in the part it starts in", () => {
        // The singer ends a slide between the piano's two written ends: none of the singer's
        // marks may close the piano's sweep or open one of its own that the piano closes.
        const gliss = (type: string) => `<glissando type="${type}"/>`;
        const doc = partwise([
            {
                id: "P1",
                body: `${ONE_STAFF}${quarter("G", 4)}${quarter("A", 4, 1, "1", `<slide type="stop"/>`)}${quarter("B", 4)}${quarter("D", 4)}`,
            },
            {
                id: "P2",
                body: `${TWO_STAVES}${quarter("C", 5, 1, "1", gliss("start"))}${quarter("D", 5)}${quarter("C", 6, 1, "1", gliss("stop"))}${quarter("F", 5)}`,
            },
        ]);
        expect(readScoreMarks(doc).glissandos).toEqual([
            { from: 0, to: 0.75, arrivesAt: 84, pitch: 72 },
        ]);
    });
    it("sets the loudness from the piano's dynamics, not the singer's", () => {
        const doc = partwise([
            {
                id: "P1",
                body: `${ONE_STAFF}${quarter("G", 4)}${direction("<dynamics><pp/></dynamics>")}${quarter("A", 4)}${direction('<wedge type="crescendo"/>')}${quarter("B", 4)}${quarter("C", 5)}`,
            },
            {
                id: "P2",
                body: `${TWO_STAVES}${direction("<dynamics><f/></dynamics>")}${quarter("C", 5)}${quarter("D", 5)}${quarter("E", 5)}${quarter("F", 5)}`,
            },
        ]);
        for (const accompaniment of [false, true]) {
            expect(readScoreMarks(doc, { accompaniment }).dynamics).toEqual([
                { whole: 0, volume: 96, ramp: false },
            ]);
        }
    });

    it("still takes the tempo from whichever part writes it", () => {
        // Every part of a score shares one pulse, and an engraver writes the tempo over
        // the top staff — which on an art song is the singer's.
        const doc = partwise([
            {
                id: "P1",
                body: `${ONE_STAFF}<direction><direction-type><metronome><beat-unit>quarter</beat-unit><per-minute>72</per-minute></metronome></direction-type></direction>${quarter("G", 4)}`,
            },
            { id: "P2", body: `${TWO_STAVES}${quarter("C", 5)}` },
        ]);
        expect(readScoreMarks(doc, { accompaniment: false }).tempi).toEqual([
            { whole: 0, bpm: 72 },
        ]);
    });
});
