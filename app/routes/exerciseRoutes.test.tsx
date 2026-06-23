// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Exercise } from "../lib/exercises";
import { saveUserSong } from "../lib/songs";
import Loop from "./loop";
import Practice, { meta as practiceMeta } from "./practice";
import Rhythm from "./rhythm";
import Tempo from "./tempo";
import TimeTrial from "./time-trial";

const SONG: Exercise = {
    id: "test-scale",
    title: "Test scale",
    description: "",
    abc: "X:1\nT:Test scale\nM:4/4\nL:1/4\nK:C\nC D E F |",
    tempo: 90,
    beatsPerBar: 4,
};

beforeEach(() => saveUserSong(SONG));
afterEach(() => localStorage.clear());

// Each per-exercise route resolves the id and either renders its trainer or
// throws a 404 Response. Calling the component function directly exercises that
// branch without a router.
type RouteFn = (props: { params: { exerciseId: string } }) => unknown;
type MetaFn = (args: { params: { exerciseId: string } }) => { title?: string }[];

const routes: [string, RouteFn][] = [
    ["practice", Practice as unknown as RouteFn],
    ["time-trial", TimeTrial as unknown as RouteFn],
    ["rhythm", Rhythm as unknown as RouteFn],
    ["tempo", Tempo as unknown as RouteFn],
    ["loop", Loop as unknown as RouteFn],
];

describe.each(routes)("%s route", (_name, route) => {
    it("renders a trainer for a song on the device", () => {
        expect(route({ params: { exerciseId: "test-scale" } })).toBeTruthy();
    });

    it("throws a 404 response for an unknown id", () => {
        let error: unknown;
        try {
            route({ params: { exerciseId: "does-not-exist" } });
        } catch (caught) {
            error = caught;
        }
        expect(error).toBeInstanceOf(Response);
        expect((error as Response).status).toBe(404);
    });
});

describe("page titles", () => {
    it("names the song and mode, ending in the brand", () => {
        const tags = (practiceMeta as unknown as MetaFn)({ params: { exerciseId: "test-scale" } });
        expect(tags.find((tag) => tag.title)?.title).toBe("Test scale · Practice · Plinky");
    });

    it("falls back to the mode for an unknown id", () => {
        const tags = (practiceMeta as unknown as MetaFn)({ params: { exerciseId: "nope" } });
        expect(tags.find((tag) => tag.title)?.title).toBe("Practice · Plinky");
    });
});
