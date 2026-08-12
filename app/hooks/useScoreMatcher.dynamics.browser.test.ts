// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { OpenSheetMusicDisplay } from "opensheetmusicdisplay";
import { afterEach, describe, expect, it } from "vitest";
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

const asked = (osmd: OpenSheetMusicDisplay) =>
    collectMatchSteps(osmd, "both").map((step) => step.expected?.[0]?.velocity ?? null);

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
