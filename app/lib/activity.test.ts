// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { createActivitySignal, holdWhile } from "./activity";

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

describe("holdWhile", () => {
    it("is active while the work runs and idle once it resolves, passing its value on", async () => {
        const signal = createActivitySignal();
        let finish: (value: string) => void = () => {};
        const held = holdWhile(signal, () => new Promise<string>((resolve) => (finish = resolve)));
        expect(signal.active()).toBe(true);
        finish("file");
        await expect(held).resolves.toBe("file");
        expect(signal.active()).toBe(false);
    });

    it("releases the hold when the work rejects, and passes the rejection on", async () => {
        const signal = createActivitySignal();
        await expect(
            holdWhile(signal, async () => Promise.reject(new Error("no"))),
        ).rejects.toThrow("no");
        expect(signal.active()).toBe(false);
    });

    it("releases the hold when the work throws before returning a promise", async () => {
        const signal = createActivitySignal();
        const work = (): Promise<void> => {
            throw new Error("sync");
        };
        await expect(holdWhile(signal, work)).rejects.toThrow("sync");
        expect(signal.active()).toBe(false);
    });

    it("leaves an overlapping activity holding after its own work ends", async () => {
        const signal = createActivitySignal();
        const endRun = signal.begin();
        await holdWhile(signal, async () => {});
        expect(signal.active()).toBe(true);
        endRun();
        expect(signal.active()).toBe(false);
    });
});
