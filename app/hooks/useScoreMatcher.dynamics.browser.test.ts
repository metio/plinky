// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { OpenSheetMusicDisplay } from "opensheetmusicdisplay";
import { afterEach, describe, expect, it } from "vitest";
import { NO_SCORE_MARKS, readScoreMarks, type ScoreMarks } from "../../core/musicxmlMarks";
import { collectListenSteps } from "./useListenPlayback";
import { collectMatchSteps } from "./useScoreMatcher";

// The test that was missing. Every unit test of the dynamics reader ran against a
// hand-built object shaped the way OSMD documents its cursor — and the cursor never
// produces it, so a reader that returned null on every real score passed all of them for
// years. These load MusicXML into a live OSMD and ask what the run is graded against.
const ATTR = `<attributes><divisions>4</divisions><key><fifths>0</fifths></key><time><beats>4</beats><beat-type>4</beat-type></time><clef><sign>G</sign><line>2</line></clef></attributes>`;

const half = (step: string) =>
    `<note><pitch><step>${step}</step><octave>4</octave></pitch><duration>8</duration><voice>1</voice><type>half</type></note>`;

const dynamic = (mark: string) =>
    `<direction placement="below"><direction-type><dynamics><${mark}/></dynamics></direction-type></direction>`;

const wedge = (type: string) =>
    `<direction placement="below"><direction-type><wedge type="${type}"/></direction-type></direction>`;

const score = (measures: string) => `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="3.1">
  <part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list>
  <part id="P1">${measures}</part>
</score-partwise>`;

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

const asked = (osmd: OpenSheetMusicDisplay) =>
    collectMatchSteps(osmd, "both", marks).map((step) => step.expected?.[0]?.velocity ?? null);

afterEach(() => {
    host?.remove();
    host = null;
});

describe("a score that writes its dynamics", () => {
    it("asks for the marked loudness, and keeps asking after the bar it is written in", () => {
        return load(
            score(`
   <measure number="1">${ATTR}${dynamic("mf")}${half("C")}${half("D")}</measure>
   <measure number="2">${half("E")}${half("F")}</measure>`),
        ).then((osmd) => {
            const velocities = asked(osmd);
            expect(velocities).toHaveLength(4);
            // A mark stands until the next one: all four notes are asked for it, including
            // the two in the bar that carries no mark of its own.
            for (const velocity of velocities) {
                expect(velocity).not.toBeNull();
            }
            expect(new Set(velocities).size).toBe(1);
        });
    });

    it("changes where the score changes it", () => {
        return load(
            score(`
   <measure number="1">${ATTR}${dynamic("p")}${half("C")}${half("D")}</measure>
   <measure number="2">${dynamic("f")}${half("E")}${half("F")}</measure>`),
        ).then((osmd) => {
            const [first, second, third, fourth] = asked(osmd);
            expect(first).toBe(second);
            expect(third).toBe(fourth);
            expect(third as number).toBeGreaterThan(first as number);
        });
    });

    it("swells through a hairpin rather than jumping at the end of it", () => {
        return load(
            score(`
   <measure number="1">${ATTR}${dynamic("p")}${wedge("crescendo")}${half("C")}${half("D")}</measure>
   <measure number="2">${half("E")}${half("F")}</measure>
   <measure number="3">${wedge("stop")}${dynamic("f")}${half("G")}${half("A")}</measure>`),
        ).then((osmd) => {
            const velocities = asked(osmd) as number[];
            // Rising the whole way, and the notes under the wedge sit between the two
            // marks rather than staying quiet until the forte lands.
            for (const [index, velocity] of velocities.entries()) {
                if (index > 0) {
                    expect(velocity).toBeGreaterThanOrEqual(velocities[index - 1] as number);
                }
            }
            expect(velocities[velocities.length - 1] as number).toBeGreaterThan(
                velocities[0] as number,
            );
            expect(velocities[2] as number).toBeGreaterThan(velocities[0] as number);
        });
    });

    it("asks for nothing in particular when the score marks nothing", () => {
        return load(score(`<measure number="1">${ATTR}${half("C")}${half("D")}</measure>`)).then(
            (osmd) => {
                expect(asked(osmd)).toEqual([null, null]);
            },
        );
    });
});

describe("a score that marks no dynamics at all", () => {
    it("still gives the bar its shape, rather than playing every note alike", () => {
        // Most of the catalogue is like this — a teaching study prints nothing, because a
        // player is expected to supply the weighting. Sounded literally it is a metronome
        // with pitches: the bar has no shape and a beginner listening for guidance hears
        // something no pianist would play.
        const quarter = (step: string) =>
            `<note><pitch><step>${step}</step><octave>4</octave></pitch><duration>4</duration><voice>1</voice><type>quarter</type></note>`;
        return load(
            score(
                `<measure number="1">${ATTR}${quarter("C")}${quarter("D")}${quarter("E")}${quarter("F")}</measure>`,
            ),
        ).then((osmd) => {
            const steps = collectListenSteps(osmd, marks);
            const weights = steps.map((step) => step.interpretation);
            expect(weights).toHaveLength(4);
            // The downbeat carries most, the third beat next, two and four least — which is
            // what makes a four-four bar sound unlike any other.
            expect(weights[0]).toBe(1);
            expect(weights[2]).toBeLessThan(weights[0] as number);
            expect(weights[1]).toBeLessThan(weights[2] as number);
            expect(weights[1]).toBe(weights[3]);
        });
    });

    it("keeps the shaping under what the page asks, never above it", () => {
        const quarter = (step: string) =>
            `<note><pitch><step>${step}</step><octave>4</octave></pitch><duration>4</duration><voice>1</voice><type>quarter</type></note>`;
        return load(
            score(
                `<measure number="1">${ATTR}${dynamic("ff")}${quarter("C")}${quarter("D")}</measure>`,
            ),
        ).then((osmd) => {
            const steps = collectListenSteps(osmd, marks);
            expect(steps.every((step) => step.interpretation <= 1)).toBe(true);
        });
    });

    it("asks the player for what the page says, not for the interpretation", () => {
        // The line this whole layer rests on. A run is graded against the written
        // intention; marking somebody down for not guessing an unwritten accent would be
        // indefensible, and quietly grading them against a shaped performance is the same
        // thing done invisibly. The shaping is in what is PLAYED and nowhere else.
        const quarter = (step: string) =>
            `<note><pitch><step>${step}</step><octave>4</octave></pitch><duration>4</duration><voice>1</voice><type>quarter</type></note>`;
        return load(
            score(
                `<measure number="1">${ATTR}${dynamic("mf")}${quarter("C")}${quarter("D")}${quarter("E")}${quarter("F")}</measure>`,
            ),
        ).then((osmd) => {
            const asked = collectMatchSteps(osmd, "both", marks).map(
                (step) => step.expected?.[0]?.velocity ?? null,
            );
            // One dynamic, four notes, one answer: every beat is asked for at the marked
            // loudness however the bar is played back.
            expect(new Set(asked).size).toBe(1);

            const played = collectListenSteps(osmd, marks).map((step) => step.interpretation);
            expect(new Set(played).size).toBeGreaterThan(1);
        });
    });
});
