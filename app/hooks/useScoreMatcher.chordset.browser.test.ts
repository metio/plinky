// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { OpenSheetMusicDisplay } from "opensheetmusicdisplay";
import { afterEach, describe, expect, it } from "vitest";
import { generateExercise, parseExerciseId } from "../../core/exerciseGen";
import { collectMatchSteps } from "./useScoreMatcher";

// A generated chord set through the real engraver: each block is one position asking
// for three keys at once, and the walk up and back is fifteen of them.
let host: HTMLDivElement | null = null;

afterEach(() => {
    host?.remove();
    host = null;
});

async function engrave(xml: string): Promise<OpenSheetMusicDisplay> {
    host = document.createElement("div");
    host.style.width = "800px";
    document.body.appendChild(host);
    const osmd = new OpenSheetMusicDisplay(host, { drawingParameters: "compact" });
    await osmd.load(xml);
    osmd.render();
    return osmd;
}

describe("a chord set on the play page", () => {
    it("asks for each triad as one position of three keys", async () => {
        const config = parseExerciseId("chords-c-major");
        expect(config).not.toBeNull();
        const osmd = await engrave(generateExercise(config!));
        const steps = collectMatchSteps(osmd, "both");
        expect(steps).toHaveLength(15);
        expect(steps[0]?.pitches.sort((a, b) => a - b)).toEqual([60, 64, 67]);
        expect(steps[7]?.pitches.sort((a, b) => a - b)).toEqual([72, 76, 79]);
        expect(steps.every((step) => step.pitches.length === 3)).toBe(true);
    });

    it("gives both hands their own staff, the left an octave down", async () => {
        const config = parseExerciseId("chords-c-major.1b");
        const osmd = await engrave(generateExercise(config!));
        const steps = collectMatchSteps(osmd, "both");
        expect(steps[0]?.pitches.sort((a, b) => a - b)).toEqual([48, 52, 55, 60, 64, 67]);
        expect(collectMatchSteps(osmd, "left")[0]?.pitches.sort((a, b) => a - b)).toEqual([
            48, 52, 55,
        ]);
    });

    it("engraves the dialled forms the way the generator spelled them", async () => {
        // Sevenths in open position as an Alberti bass: one bar per chord, four single
        // notes, reaching root, top, middle, top of C E G B opened to C G E B.
        const config = parseExerciseId("chords-c-major.1r7oa");
        expect(config).not.toBeNull();
        const osmd = await engrave(generateExercise(config!));
        const steps = collectMatchSteps(osmd, "both");
        expect(steps).toHaveLength(60);
        expect(steps.slice(0, 4).map((step) => step.pitches)).toEqual([[60], [83], [67], [83]]);
        // A broken triad in the left hand, one octave down.
        const broken = await engrave(generateExercise(parseExerciseId("chords-c-major.1lk")!));
        expect(
            collectMatchSteps(broken, "both")
                .slice(0, 4)
                .map((step) => step.pitches),
        ).toEqual([[48], [52], [55], [52]]);
    });
});
