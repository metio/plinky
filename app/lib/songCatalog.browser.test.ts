// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import abcjs from "abcjs";
import { afterEach, describe, expect, it } from "vitest";
import { buildSteps } from "./steps";

// Every catalog source song under songs/ must render and produce playable steps,
// so a typo'd ABC can never ship to the bundled registry pack.
const modules = import.meta.glob("../../songs/*.json", { eager: true });
const songs = Object.entries(modules)
    .filter(([path]) => !path.includes("_curriculums"))
    .map(([, mod]) => (mod as { default: { id: string; abc: string } }).default);

let mounted: HTMLElement[] = [];
afterEach(() => {
    for (const element of mounted) {
        element.remove();
    }
    mounted = [];
});

describe("catalog songs", () => {
    it("has songs to check", () => {
        expect(songs.length).toBeGreaterThan(0);
    });

    it.each(
        songs.map((song) => [song.id, song] as const),
    )("%s renders and is playable", (_id, song) => {
        const element = document.createElement("div");
        document.body.appendChild(element);
        mounted.push(element);
        const tune = abcjs.renderAbc(element, song.abc, { add_classes: true })[0];
        expect(tune).toBeTruthy();
        expect(buildSteps(tune, 100).length).toBeGreaterThan(0);
    });
});
