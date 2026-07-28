// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { afterEach, describe, expect, it } from "vitest";
import { DEFAULT_DRILL, generateDrill } from "./drill";

// A drill's value is that its MusicXML actually renders, so load each one into OSMD
// — the same engine it will be played on — and confirm it draws. Chords and wide
// ranges are the shapes most likely to produce markup OSMD rejects.
let containers: HTMLElement[] = [];

afterEach(() => {
    for (const element of containers) {
        element.remove();
    }
    containers = [];
});

async function renders(xml: string): Promise<boolean> {
    const { OpenSheetMusicDisplay } = await import("opensheetmusicdisplay");
    const element = document.createElement("div");
    document.body.appendChild(element);
    containers.push(element);
    const osmd = new OpenSheetMusicDisplay(element, {
        autoResize: false,
        drawingParameters: "compact",
    });
    await osmd.load(xml);
    osmd.render();
    return element.querySelector("svg") !== null;
}

describe("generated drills render on OSMD", () => {
    it("renders a single-hand drill", async () => {
        const xml = generateDrill({ ...DEFAULT_DRILL, bars: 2 }, () => 0);
        expect(await renders(xml)).toBe(true);
    });

    it("renders a two-hand grand-staff drill", async () => {
        const xml = generateDrill({ ...DEFAULT_DRILL, bars: 1, hands: 2, low: 48, high: 84 }, () => 0);
        expect(await renders(xml)).toBe(true);
    });

    it("renders stacked chords", async () => {
        const xml = generateDrill(
            { ...DEFAULT_DRILL, bars: 1, notesPerColumn: 3, low: 60, high: 84 },
            () => 0.5,
        );
        expect(await renders(xml)).toBe(true);
    });

    it("renders a chromatic drill in a far-flung signature", async () => {
        const xml = generateDrill(
            { ...DEFAULT_DRILL, bars: 2, chromatic: true, fifths: -6, low: 48, high: 84 },
            () => 0.3,
        );
        expect(await renders(xml)).toBe(true);
    });
});
