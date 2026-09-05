// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { OpenSheetMusicDisplay } from "opensheetmusicdisplay";
import { afterEach, describe, expect, it } from "vitest";
import { collectListenSteps } from "../lib/listenSteps";
import { collectKeepUpSteps } from "./useKeepUp";

// The three shapes where one voice moves on inside the other's note, engraved for real:
// a walk over the fakes cannot reach them, because a fake places its positions where the
// rule under test expects them. Each is asserted on both sounding walks — Listen and Keep
// up keep time by the same clock, and this is where that is proved rather than assumed.
//
// Every score is two-four with a quarter of twenty-four divisions, one bar, two staves.

const ATTR = `<attributes><divisions>24</divisions><key><fifths>0</fifths></key><time><beats>2</beats><beat-type>4</beat-type></time><staves>2</staves><clef number="1"><sign>G</sign><line>2</line></clef><clef number="2"><sign>F</sign><line>4</line></clef></attributes>`;

const note = (
    step: string,
    octave: number,
    duration: number,
    type: string,
    staff: 1 | 2,
    extra = "",
) =>
    `<note><pitch><step>${step}</step><octave>${octave}</octave></pitch><duration>${duration}</duration><voice>${staff}</voice><type>${type}</type>${extra}<staff>${staff}</staff></note>`;

const score = (right: string, left: string) => `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="3.1">
  <part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list>
  <part id="P1"><measure number="1">${ATTR}${right}<backup><duration>48</duration></backup>${left}</measure></part>
</score-partwise>`;

const TRIPLET = `<time-modification><actual-notes>3</actual-notes><normal-notes>2</normal-notes></time-modification>`;

// Right hand: triplet quavers over the whole bar. Left hand: plain quavers.
const TWO_AGAINST_THREE = score(
    ["C", "E", "G", "C", "E", "G"].map((step) => note(step, 5, 8, "eighth", 1, TRIPLET)).join(""),
    ["C", "G", "C", "G"].map((step) => note(step, 3, 12, "eighth", 2)).join(""),
);

// Right hand: a quaver, a syncopated crotchet, a quaver. Left hand: two crotchets.
const SYNCOPATION = score(
    note("C", 5, 12, "eighth", 1) + note("D", 5, 24, "quarter", 1) + note("E", 5, 12, "eighth", 1),
    note("C", 3, 24, "quarter", 2) + note("G", 3, 24, "quarter", 2),
);

// Right hand: a dotted semiquaver, a demisemiquaver, then a quaver and a crotchet. Left
// hand: semiquavers — the Für Elise figure, where the demisemiquaver arrives before the
// semiquaver under it ends.
const DOTTED = score(
    note("F", 5, 9, "16th", 1, "<dot/>") +
        note("E", 5, 3, "32nd", 1) +
        note("D", 5, 12, "eighth", 1) +
        note("C", 5, 24, "quarter", 1),
    ["F", "A", "C", "A", "F", "A", "C", "A"].map((step) => note(step, 3, 6, "16th", 2)).join(""),
);

let host: HTMLDivElement | null = null;

async function engrave(xml: string): Promise<OpenSheetMusicDisplay> {
    host = document.createElement("div");
    host.style.width = "800px";
    document.body.appendChild(host);
    const osmd = new OpenSheetMusicDisplay(host, { drawingParameters: "compact" });
    await osmd.load(xml);
    osmd.render();
    return osmd;
}

afterEach(() => {
    host?.remove();
    host = null;
});

// The dwell at each position in quarters, as the walk keeps time.
const dwells = (steps: { lengths: number[] }[]) =>
    steps.map((step) => Number(Math.min(...step.lengths).toFixed(4)));

const third = Number((1 / 3).toFixed(4));
const sixth = Number((1 / 6).toFixed(4));

describe("where one voice moves inside the other's note", () => {
    it("keeps two against three: each triplet note lasts to the quaver that falls inside it", async () => {
        const osmd = await engrave(TWO_AGAINST_THREE);
        const expected = [third, sixth, sixth, third, third, sixth, sixth, third];
        expect(dwells(collectListenSteps(osmd))).toEqual(expected);
        expect(dwells(collectKeepUpSteps(osmd, "both"))).toEqual(expected);
    });

    it("keeps a syncopation: the tied-over crotchet does not hold the bass back", async () => {
        const osmd = await engrave(SYNCOPATION);
        const expected = [0.5, 0.5, 0.5, 0.5];
        expect(dwells(collectListenSteps(osmd))).toEqual(expected);
        expect(dwells(collectKeepUpSteps(osmd, "both"))).toEqual(expected);
    });

    it("keeps a dotted figure: the demisemiquaver lands before the semiquaver under it ends", async () => {
        const osmd = await engrave(DOTTED);
        const expected = [0.25, 0.125, 0.125, 0.25, 0.25, 0.25, 0.25, 0.25, 0.25];
        expect(dwells(collectListenSteps(osmd))).toEqual(expected);
        expect(dwells(collectKeepUpSteps(osmd, "both"))).toEqual(expected);
    });

    it("adds up to the bar on every one of them", async () => {
        for (const xml of [TWO_AGAINST_THREE, SYNCOPATION, DOTTED]) {
            const osmd = await engrave(xml);
            const total = dwells(collectListenSteps(osmd)).reduce((sum, one) => sum + one, 0);
            expect(total).toBeCloseTo(2, 3);
            host?.remove();
            host = null;
        }
    });
});
