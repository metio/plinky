// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import Loop from "./loop";
import Practice from "./practice";
import Rhythm from "./rhythm";
import Tempo from "./tempo";
import TimeTrial from "./time-trial";

// Each per-exercise route resolves the id and either renders its trainer or
// throws a 404 Response. Calling the component function directly exercises that
// branch without a router.
type RouteFn = (props: { params: { exerciseId: string } }) => unknown;

const routes: [string, RouteFn][] = [
    ["practice", Practice as unknown as RouteFn],
    ["time-trial", TimeTrial as unknown as RouteFn],
    ["rhythm", Rhythm as unknown as RouteFn],
    ["tempo", Tempo as unknown as RouteFn],
    ["loop", Loop as unknown as RouteFn],
];

describe.each(routes)("%s route", (_name, route) => {
    it("renders a trainer for a known exercise", () => {
        expect(route({ params: { exerciseId: "c-major-scale" } })).toBeTruthy();
    });

    it("throws a 404 response for an unknown exercise", () => {
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
