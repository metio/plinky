// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { OpenSheetMusicDisplay } from "opensheetmusicdisplay";
import { afterEach, describe, expect, it } from "vitest";
import { collectSteps } from "../hooks/useScoreMatcher";
import { generatePhrase } from "../../core/generator";
import { collectNoteElements } from "./scoreColor";

// OSMD renders only in a real browser, so this runs in the browser project.
const containers: HTMLElement[] = [];
afterEach(() => {
    for (const element of containers) {
        element.remove();
    }
    containers.length = 0;
});

async function renderOsmd(xml: string): Promise<OpenSheetMusicDisplay> {
    const container = document.createElement("div");
    document.body.appendChild(container);
    containers.push(container);
    const osmd = new OpenSheetMusicDisplay(container, { autoResize: false });
    await osmd.load(xml);
    osmd.render();
    return osmd;
}

const PHRASE = generatePhrase({ bars: 1, beatsPerBar: 4, twoHands: false }, () => 0);

describe("collectNoteElements", () => {
    it("produces one step per playable position, in step with the matcher", async () => {
        const osmd = await renderOsmd(PHRASE);
        expect(collectNoteElements(osmd, "both").length).toBe(collectSteps(osmd, "both").length);
    });

    it("keeps a step whose note has no rendered glyph so ghost markers stay aligned", async () => {
        const osmd = await renderOsmd(PHRASE);
        const expected = collectSteps(osmd, "both").length;
        expect(expected).toBeGreaterThan(0);
        // Simulate OSMD exposing no SVG group for any note (a glyph it didn't draw).
        // The step count must still match the matcher's, or every later ghost marker
        // lands on the wrong note.
        osmd.cursor.show();
        osmd.cursor.reset();
        while (!osmd.cursor.iterator.EndReached) {
            for (const gNote of osmd.cursor.GNotesUnderCursor()) {
                (gNote as { getSVGGElement?: () => undefined }).getSVGGElement = () => undefined;
            }
            osmd.cursor.next();
        }
        osmd.cursor.reset();
        expect(collectNoteElements(osmd, "both").length).toBe(expected);
    });
});
