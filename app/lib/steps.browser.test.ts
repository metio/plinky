// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import abcjs from "abcjs";
import { afterEach, describe, expect, it } from "vitest";
import { buildSteps } from "./steps";

// abcjs only fills in note pitches under a real browser layout, so buildSteps is
// covered here in browser mode rather than node/jsdom. The render target must be
// attached to the document for abcjs to measure and emit the pitch data.
let mounted: HTMLElement[] = [];

afterEach(() => {
    for (const element of mounted) {
        element.remove();
    }
    mounted = [];
});

function steps(abc: string) {
    const element = document.createElement("div");
    document.body.appendChild(element);
    mounted.push(element);
    const tune = abcjs.renderAbc(element, abc, { add_classes: true })[0];
    return buildSteps(tune, 100);
}

const HEADER = "X:1\nM:4/4\nL:1/4\nK:C\n";

describe("buildSteps", () => {
    it("maps single notes to one-pitch steps", () => {
        const result = steps(`${HEADER}C D E F |`);
        expect(result).toHaveLength(4);
        expect(result.map((step) => step.pitches)).toEqual([[60], [62], [64], [65]]);
    });

    it("maps a chord to one step carrying every pitch", () => {
        const result = steps(`${HEADER}[CEG] D |`);
        expect(result).toHaveLength(2);
        expect(result[0]!.pitches).toEqual([60, 64, 67]);
    });

    it("drops rests but folds their duration into the next onset", () => {
        const result = steps(`${HEADER}C z E F |`);
        expect(result.map((step) => step.pitches[0])).toEqual([60, 64, 65]);
        // The rest's duration survives as a wider gap before the note after it.
        expect(result[1]!.timeMs - result[0]!.timeMs).toBeGreaterThan(
            result[2]!.timeMs - result[1]!.timeMs,
        );
    });

    it("expands repeats into the played sequence", () => {
        const result = steps(`${HEADER}|: C D :| E F |`);
        expect(result.map((step) => step.pitches[0])).toEqual([60, 62, 60, 62, 64, 65]);
    });
});
