// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { OpenSheetMusicDisplay } from "opensheetmusicdisplay";
import { afterEach, describe, expect, it } from "vitest";
import { stripAccompaniment } from "../../core/accompaniment";
import { readScoreMarks } from "../../core/musicxmlMarks";
import { domXmlCodec } from "../adapters/domXmlCodec";
import { collectListenSteps } from "../lib/listenSteps";
import { collectMatchSteps } from "./useScoreMatcher";

// Marks on a score written for more than one part, read the way the play surface reads them.
//
// The page is drawn from the score with the other parts taken off (unless the player asks
// for them), and the marks are read from the file as written. The two agree about which
// staff is which only if the marks are numbered for the page actually drawn — so these
// engrave that page, read the marks for it, and ask Listen and the graded run what they do.

const ONE_STAFF = `<attributes><divisions>4</divisions><key><fifths>0</fifths></key><time><beats>4</beats><beat-type>4</beat-type></time><clef><sign>G</sign><line>2</line></clef></attributes>`;
const TWO_STAVES = `<attributes><divisions>4</divisions><key><fifths>0</fifths></key><time><beats>4</beats><beat-type>4</beat-type></time><staves>2</staves><clef number="1"><sign>G</sign><line>2</line></clef><clef number="2"><sign>F</sign><line>4</line></clef></attributes>`;

const quarter = (step: string, octave: number, staff = 1, voice = "1", notations = "") =>
    `<note><pitch><step>${step}</step><octave>${octave}</octave></pitch><duration>4</duration><voice>${voice}</voice><type>quarter</type><staff>${staff}</staff>${
        notations ? `<notations>${notations}</notations>` : ""
    }</note>`;

const BASS_STAFF = `<attributes><divisions>4</divisions><key><fifths>0</fifths></key><time><beats>4</beats><beat-type>4</beat-type></time><clef><sign>F</sign><line>4</line></clef></attributes>`;

const whole = (step: string, octave: number, notations = "") =>
    `<note><pitch><step>${step}</step><octave>${octave}</octave></pitch><duration>16</duration><voice>1</voice><type>whole</type>${
        notations ? `<notations>${notations}</notations>` : ""
    }</note>`;

const dynamic = (mark: string) =>
    `<direction placement="below"><direction-type><dynamics><${mark}/></dynamics></direction-type></direction>`;

const BACK = "<backup><duration>16</duration></backup>";
const STACCATO = "<articulations><staccato/></articulations>";

const partwise = (parts: { id: string; body: string }[]) => `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="3.1"><part-list>${parts
    .map((one) => `<score-part id="${one.id}"><part-name>${one.id}</part-name></score-part>`)
    .join("")}</part-list>${parts
    .map((one) => `<part id="${one.id}"><measure number="1">${one.body}</measure></part>`)
    .join("")}</score-partwise>`;

const SINGER = `${ONE_STAFF}${quarter("G", 4)}${quarter("A", 4)}${quarter("B", 4)}${quarter("D", 4)}`;
// A right-hand arch over three notes, and a staccato left hand under it with no arch.
const SLURRED_PIANO = `${TWO_STAVES}${quarter("C", 5, 1, "1", '<slur number="1" type="start"/>')}${quarter("D", 5)}${quarter("E", 5, 1, "1", '<slur number="1" type="stop"/>')}${quarter("F", 5)}${BACK}${["C", "G", "G", "C"].map((step) => quarter(step, 3, 2, "5", STACCATO)).join("")}`;

let host: HTMLDivElement | null = null;

// The page the play surface draws, and the marks it reads for that page.
function engrave(xml: string, accompaniment: boolean) {
    const marks = readScoreMarks(new DOMParser().parseFromString(xml, "application/xml"), {
        accompaniment,
    });
    const page = accompaniment ? xml : stripAccompaniment(domXmlCodec, xml);
    host = document.createElement("div");
    host.style.width = "800px";
    document.body.appendChild(host);
    const osmd = new OpenSheetMusicDisplay(host, { drawingParameters: "compact" });
    return osmd.load(page).then(() => {
        osmd.render();
        return { osmd, marks };
    });
}

// Whether Listen joins each pitch onward, at every position it strikes one.
function slurredByPitch(steps: ReturnType<typeof collectListenSteps>): Map<number, boolean[]> {
    const found = new Map<number, boolean[]>();
    for (const step of steps) {
        for (const note of step.notes) {
            found.set(note.pitch, [...(found.get(note.pitch) ?? []), note.slurred]);
        }
    }
    return found;
}

afterEach(() => {
    host?.remove();
    host = null;
});

describe("an art song's arches, with the singer taken off the page", () => {
    it("joins the right hand under its arch and leaves the staccato bass detached", () => {
        return engrave(
            partwise([
                { id: "P1", body: SINGER },
                { id: "P2", body: SLURRED_PIANO },
            ]),
            false,
        ).then(({ osmd, marks }) => {
            const slurred = slurredByPitch(collectListenSteps(osmd, marks));
            // C5 and D5 are under the arch; E5 closes it.
            expect(slurred.get(72)).toEqual([true]);
            expect(slurred.get(74)).toEqual([true]);
            expect(slurred.get(76)).toEqual([false]);
            // The bass has no arch of its own.
            expect(slurred.get(48)).toEqual([false, false]);
            expect(slurred.get(55)).toEqual([false, false]);
        });
    });

    it("asks the player to lift the staccato bass rather than hold it under the tune's arch", () => {
        return engrave(
            partwise([
                { id: "P1", body: SINGER },
                { id: "P2", body: SLURRED_PIANO },
            ]),
            false,
        ).then(({ osmd, marks }) => {
            const first = collectMatchSteps(osmd, "left", marks)[0];
            const asked = first?.expected?.[0];
            expect(asked).toBeDefined();
            expect(asked?.holdMs as number).toBeLessThan(asked?.writtenHoldMs as number);
        });
    });

    it("reads the same with the singer drawn above the piano", () => {
        return engrave(
            partwise([
                { id: "P1", body: SINGER },
                { id: "P2", body: SLURRED_PIANO },
            ]),
            true,
        ).then(({ osmd, marks }) => {
            const slurred = slurredByPitch(collectListenSteps(osmd, marks));
            expect(slurred.get(72)).toEqual([true]);
            expect(slurred.get(48)).toEqual([false, false]);
            // The singer's line carries no arch.
            expect(slurred.get(67)).toEqual([false]);
        });
    });

    for (const accompaniment of [false, true]) {
        it(`finds the piano's arch below two singers (${accompaniment ? "drawn" : "taken off"})`, () => {
            return engrave(
                partwise([
                    { id: "S", body: SINGER },
                    { id: "A", body: SINGER },
                    { id: "P", body: SLURRED_PIANO },
                ]),
                accompaniment,
            ).then(({ osmd, marks }) => {
                const slurred = slurredByPitch(collectListenSteps(osmd, marks));
                expect(slurred.get(72)).toEqual([true]);
                expect(slurred.get(48)).toEqual([false, false]);
            });
        });
    }
});

describe("a tremolo on a score of more than one part", () => {
    const TREMOLO = '<ornaments><tremolo type="single">3</tremolo></ornaments>';

    it("shakes the right hand's note alone on a piano written as two single-staff parts", () => {
        return engrave(
            partwise([
                { id: "RH", body: `${ONE_STAFF}${whole("C", 5, TREMOLO)}` },
                { id: "LH", body: `${BASS_STAFF}${whole("C", 3)}` },
            ]),
            false,
        ).then(({ osmd, marks }) => {
            const figure = collectListenSteps(osmd, marks).filter((step) => step.whole === 0);
            expect(figure.length).toBeGreaterThan(2);
            // The C5 shakes; the bass C3 struck with it sounds once.
            expect(figure.every((step) => step.notes.some((note) => note.pitch === 72))).toBe(true);
            expect(
                figure.filter((step) => step.notes.some((note) => note.pitch === 48)),
            ).toHaveLength(1);
        });
    });

    it("never sounds the singer's note, which is not on the page", () => {
        return engrave(
            partwise([
                { id: "P1", body: SINGER },
                {
                    id: "P2",
                    body: `${TWO_STAVES}${quarter("C", 5, 1, "1", TREMOLO)}${quarter("D", 5)}${quarter("E", 5)}${quarter("F", 5)}`,
                },
            ]),
            false,
        ).then(({ osmd, marks }) => {
            const sounded = collectListenSteps(osmd, marks).flatMap((step) =>
                step.notes.map((note) => note.pitch),
            );
            expect(sounded).not.toContain(67);
            expect(sounded.filter((pitch) => pitch === 72).length).toBeGreaterThan(2);
        });
    });
});

describe("an art song whose singer is marked softer than the piano", () => {
    const xml = partwise([
        {
            id: "P1",
            body: `${ONE_STAFF}${quarter("G", 4)}${dynamic("pp")}${quarter("A", 4)}${quarter("B", 4)}${quarter("C", 5)}`,
        },
        {
            id: "P2",
            body: `${TWO_STAVES}${dynamic("f")}${quarter("C", 5)}${quarter("D", 5)}${quarter("E", 5)}${quarter("F", 5)}`,
        },
    ]);

    for (const accompaniment of [false, true]) {
        it(`plays and asks for the piano at its own forte (${accompaniment ? "singer drawn" : "singer taken off"})`, () => {
            return engrave(xml, accompaniment).then(({ osmd, marks }) => {
                const listened = collectListenSteps(osmd, marks).map((step) => step.dynamicVolume);
                expect(listened).toEqual([96, 96, 96, 96]);
                const asked = collectMatchSteps(osmd, "right", marks).map(
                    (step) => step.expected?.[0]?.velocity ?? null,
                );
                expect(asked).toHaveLength(4);
                expect(new Set(asked).size).toBe(1);
            });
        });
    }
});
