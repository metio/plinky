// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it } from "vitest";
import { createActivitySignal } from "./activity";

describe("createActivitySignal", () => {
    it("starts idle", () => {
        expect(createActivitySignal().active()).toBe(false);
    });

    it("is active from begin until its end", () => {
        const signal = createActivitySignal();
        const end = signal.begin();
        expect(signal.active()).toBe(true);
        end();
        expect(signal.active()).toBe(false);
    });

    it("stays active until every overlapping activity ends", () => {
        const signal = createActivitySignal();
        const endFirst = signal.begin();
        const endSecond = signal.begin();
        endFirst();
        expect(signal.active()).toBe(true);
        endSecond();
        expect(signal.active()).toBe(false);
    });

    it("notifies only on the idle/active flips", () => {
        const signal = createActivitySignal();
        const flips: boolean[] = [];
        signal.subscribe(() => flips.push(signal.active()));
        const endFirst = signal.begin();
        const endSecond = signal.begin();
        endSecond();
        endFirst();
        expect(flips).toEqual([true, false]);
    });

    it("ends only once even when the end is called twice", () => {
        const signal = createActivitySignal();
        const endFirst = signal.begin();
        const endSecond = signal.begin();
        endFirst();
        endFirst();
        expect(signal.active()).toBe(true);
        endSecond();
        expect(signal.active()).toBe(false);
    });

    it("unsubscribe stops notifications", () => {
        const signal = createActivitySignal();
        let calls = 0;
        const unsubscribe = signal.subscribe(() => {
            calls += 1;
        });
        unsubscribe();
        signal.begin()();
        expect(calls).toBe(0);
    });
});
