// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { OpenSheetMusicDisplay } from "opensheetmusicdisplay";
import { afterEach, describe, expect, it } from "vitest";
import { NO_SCORE_MARKS, readScoreMarks, type ScoreMarks } from "../../core/musicxmlMarks";
import { collectListenSteps } from "./useListenPlayback";
import { collectMatchSteps } from "./useScoreMatcher";
import { readArpeggio, readOrnament } from "../lib/scoreExpression";

// Ornaments and the key they reach into, read off a live engraving.
//
// Both readings are contracts with OSMD that no fixture can stand in for. The ornament
// arrives as a bare number on a container the bundle does not export a type for, and the
// key signature is found by the shape of its data because every class in the shipped
// bundle is minified to a single letter. If either drifts, the score still plays — just
// without its ornaments, or with every one of them reaching for the wrong note. That is
// the silent kind of wrong this file exists to catch.

const attr = (fifths: number) =>
    `<attributes><divisions>4</divisions><key><fifths>${fifths}</fifths></key><time><beats>4</beats><beat-type>4</beat-type></time><clef><sign>G</sign><line>2</line></clef></attributes>`;

const ornamented = (step: string, octave: number, kind: string) =>
    `<note><pitch><step>${step}</step><octave>${octave}</octave></pitch><duration>4</duration><voice>1</voice><type>quarter</type><notations><ornaments><${kind}/></ornaments></notations></note>`;

const plain = (step: string, octave: number) =>
    `<note><pitch><step>${step}</step><octave>${octave}</octave></pitch><duration>4</duration><voice>1</voice><type>quarter</type></note>`;

const score = (measures: string) => `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="3.1">
  <part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list>
  <part id="P1">${measures}</part></score-partwise>`;

// The markings of whatever was last engraved, read from the very document the engraver was
// given — which is the path the app takes. The engraver draws the page; the file says what
// is written on it, and the two are exercised together here on purpose.
let marks: ScoreMarks = NO_SCORE_MARKS;

let host: HTMLDivElement | null = null;

function load(xml: string): Promise<OpenSheetMusicDisplay> {
    marks = readScoreMarks(new DOMParser().parseFromString(xml, "application/xml"));
    host = document.createElement("div");
    host.style.width = "800px";
    document.body.appendChild(host);
    const osmd = new OpenSheetMusicDisplay(host, { drawingParameters: "compact" });
    return osmd.load(xml).then(() => {
        osmd.render();
        return osmd;
    });
}

const kindsUnderCursor = (osmd: OpenSheetMusicDisplay) => {
    const cursor = osmd.cursor;
    cursor.reset();
    const found: (string | null)[] = [];
    while (!cursor.iterator.EndReached) {
        found.push(readOrnament(cursor.NotesUnderCursor()[0]));
        cursor.next();
    }
    cursor.reset();
    return found;
};

afterEach(() => {
    host?.remove();
    host = null;
});

describe("a score with ornaments over its notes", () => {
    it("tells one little sign from another", () => {
        // The values are bare numbers off a minified container: this is the whole contract.
        return load(
            score(
                `<measure number="1">${attr(0)}${ornamented("C", 5, "trill-mark")}${ornamented(
                    "C",
                    5,
                    "mordent",
                )}${ornamented("C", 5, "turn")}${plain("D", 5)}</measure>`,
            ),
        ).then((osmd) => {
            expect(kindsUnderCursor(osmd)).toEqual(["trill", "mordent", "turn", null]);
        });
    });

    // The key signature itself is read from the file, so testing it does not need an
    // engraving — core/musicxmlMarks.test.ts covers it in node. What still needs one is
    // below: that the key reaches the figure a real score's ornament actually plays.

    it("plays the figure in place of the note, in the key it is written in", () => {
        // E flat major: the note below C is B flat. A mordent that reached a fixed distance
        // down would sound a B natural, which is not in the piece at all.
        return load(
            score(
                `<measure number="1">${attr(-3)}${ornamented("C", 5, "mordent")}${plain("D", 5)}</measure>`,
            ),
        ).then((osmd) => {
            const steps = collectListenSteps(osmd, marks);
            const sounded = steps.flatMap((step) => step.notes.map((note) => note.pitch));
            // C5, B flat 4, C5 — then the plain D.
            expect(sounded).toEqual([72, 70, 72, 74]);
        });
    });

    it("keeps the cursor on the note the sign is printed over", () => {
        // The figure is several positions, and the eye should stay where the notation is.
        return load(
            score(
                `<measure number="1">${attr(0)}${ornamented("C", 5, "turn")}${plain("D", 5)}</measure>`,
            ),
        ).then((osmd) => {
            const steps = collectListenSteps(osmd, marks);
            const figure = steps.filter((step) => step.whole === 0);
            expect(figure.length).toBeGreaterThan(1);
            expect(figure.slice(0, -1).every((step) => !step.advancesCursor)).toBe(true);
            expect(figure.at(-1)?.advancesCursor).toBe(true);
        });
    });

    it("spends exactly the written note's time on the figure", () => {
        // A figure that ran over would push the rest of the bar late.
        return load(
            score(
                `<measure number="1">${attr(0)}${ornamented("C", 5, "trill-mark")}${plain("D", 5)}</measure>`,
            ),
        ).then((osmd) => {
            const steps = collectListenSteps(osmd, marks);
            const figure = steps.filter((step) => step.whole === 0);
            const spent = figure.reduce((sum, step) => sum + (step.lengths[0] ?? 0), 0);
            expect(spent).toBeCloseTo(1, 6);
        });
    });
});

describe("a chord the score rolls", () => {
    const chord = (arpeggiate: boolean) =>
        `<note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration><voice>1</voice><type>quarter</type>${
            arpeggiate ? "<notations><arpeggiate/></notations>" : ""
        }</note><note><chord/><pitch><step>E</step><octave>4</octave></pitch><duration>4</duration><voice>1</voice><type>quarter</type></note><note><chord/><pitch><step>G</step><octave>4</octave></pitch><duration>4</duration><voice>1</voice><type>quarter</type></note>`;

    it("sees the wavy line on the chord", () => {
        return load(score(`<measure number="1">${attr(0)}${chord(true)}</measure>`)).then(
            (osmd) => {
                osmd.cursor.reset();
                expect(osmd.cursor.NotesUnderCursor().some(readArpeggio)).toBe(true);
            },
        );
    });

    it("leaves a plain chord alone", () => {
        return load(score(`<measure number="1">${attr(0)}${chord(false)}</measure>`)).then(
            (osmd) => {
                const steps = collectListenSteps(osmd, marks);
                expect(steps).toHaveLength(1);
                expect(steps[0]?.notes.map((note) => note.pitch)).toEqual([60, 64, 67]);
            },
        );
    });

    it("strikes a rolled chord from the bottom up, one note at a time", () => {
        return load(score(`<measure number="1">${attr(0)}${chord(true)}</measure>`)).then(
            (osmd) => {
                const steps = collectListenSteps(osmd, marks);
                expect(steps.map((step) => step.notes.map((note) => note.pitch))).toEqual([
                    [60],
                    [64],
                    [67],
                ]);
            },
        );
    });

    it("keeps every note of a rolled chord ringing, so it stays a chord", () => {
        // The starts are staggered and the lengths are not: a roll whose notes stopped
        // when the next began would be a run up the arpeggio, not a chord.
        return load(score(`<measure number="1">${attr(0)}${chord(true)}</measure>`)).then(
            (osmd) => {
                const steps = collectListenSteps(osmd, marks);
                expect(steps.every((step) => step.notes[0]?.soundQuarters === 1)).toBe(true);
                // The spread is small, and the chord still spends exactly its own time.
                const spent = steps.reduce((sum, step) => sum + (step.lengths[0] ?? 0), 0);
                expect(spent).toBeCloseTo(1, 6);
                expect(steps[0]?.lengths[0]).toBeLessThan(0.25);
            },
        );
    });

    it("moves the cursor once for the whole chord", () => {
        return load(score(`<measure number="1">${attr(0)}${chord(true)}</measure>`)).then(
            (osmd) => {
                const steps = collectListenSteps(osmd, marks);
                expect(steps.filter((step) => step.advancesCursor)).toHaveLength(1);
                expect(steps.at(-1)?.advancesCursor).toBe(true);
            },
        );
    });
});

describe("a score with an 8va over it", () => {
    const shift = (type: string) =>
        `<direction placement="above"><direction-type><octave-shift type="${type}" size="8"/></direction-type></direction>`;

    it("sounds the notes where they are played, not where they are drawn", () => {
        // An 8va draws the notes an octave lower than they sound, to keep them on the
        // staff. Whether the engraving hands back the written pitch or the sounding one is
        // a contract, and getting it wrong puts a whole passage in the wrong octave — so
        // this asks rather than assumes.
        return load(
            score(
                `<measure number="1">${attr(0)}${shift("up")}${plain("C", 5)}${plain("D", 5)}${shift("stop")}</measure>
                 <measure number="2">${plain("C", 5)}</measure>`,
            ),
        ).then((osmd) => {
            const sounded = collectListenSteps(osmd, marks).flatMap((step) =>
                step.notes.map((note) => note.pitch),
            );
            // Whatever OSMD's answer is, the third note is outside the 8va and must differ
            // from the first two by exactly the octave if the shift is being applied at all.
            // Under the line an octave up; after it, at written pitch.
            expect(sounded).toEqual([84, 86, 72]);
        });
    });

    it("asks the run for the same octave it plays and prints", () => {
        // The failure this stops: printing one octave, sounding another, and grading a
        // third. A player following the line would be marked wrong for doing as told.
        return load(
            score(
                `<measure number="1">${attr(0)}${shift("up")}${plain("C", 5)}${plain("D", 5)}${shift("stop")}</measure>`,
            ),
        ).then((osmd) => {
            expect(collectMatchSteps(osmd, "both", marks).map((step) => step.pitches)).toEqual([
                [84],
                [86],
            ]);
        });
    });

    it("shifts a line the engraving never closes to the end of the music", () => {
        return load(
            score(
                `<measure number="1">${attr(0)}${shift("up")}${plain("C", 5)}</measure>
                 <measure number="2">${plain("D", 5)}</measure>`,
            ),
        ).then((osmd) => {
            const sounded = collectListenSteps(osmd, marks).flatMap((step) =>
                step.notes.map((note) => note.pitch),
            );
            expect(sounded).toEqual([84, 86]);
        });
    });

    it("leaves a score with no octave line at written pitch", () => {
        return load(
            score(`<measure number="1">${attr(0)}${plain("C", 5)}${plain("D", 5)}</measure>`),
        ).then((osmd) => {
            const sounded = collectListenSteps(osmd, marks).flatMap((step) =>
                step.notes.map((note) => note.pitch),
            );
            expect(sounded).toEqual([72, 74]);
        });
    });
});
