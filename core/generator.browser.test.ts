// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { afterEach, describe, expect, it } from "vitest";
import { generatePhrase } from "./generator";

// The generator's value is that its MusicXML actually renders, so load each phrase
// into OSMD — the same engine the sprint plays it on — and confirm it draws.
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

describe("generated phrases render on OSMD", () => {
    it("renders a single-hand phrase", async () => {
        const xml = generatePhrase({ bars: 2, beatsPerBar: 4, twoHands: false }, () => 0);
        expect(await renders(xml)).toBe(true);
    });

    it("renders a two-hand grand-staff phrase", async () => {
        const xml = generatePhrase({ bars: 1, beatsPerBar: 4, twoHands: true }, () => 0);
        expect(await renders(xml)).toBe(true);
    });
});
