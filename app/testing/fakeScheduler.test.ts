// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it } from "vitest";
import { fakeScheduler } from "./fakeScheduler";

describe("fakeScheduler", () => {
    it("fires a one-shot exactly at its due time and never again", () => {
        const sched = fakeScheduler();
        const fired: number[] = [];
        sched.after(100, () => fired.push(sched.now()));

        sched.advance(99);
        expect(fired).toEqual([]);
        sched.advance(1);
        expect(fired).toEqual([100]);
        sched.advance(1000);
        expect(fired).toEqual([100]);
        expect(sched.pending().timers).toBe(0);
    });

    it("repeats an interval across the whole advanced span", () => {
        const sched = fakeScheduler();
        const ticks: number[] = [];
        const handle = sched.every(50, () => ticks.push(sched.now()));

        sched.advance(160);
        expect(ticks).toEqual([50, 100, 150]);
        sched.cancel(handle);
        sched.advance(1000);
        expect(ticks).toEqual([50, 100, 150]);
    });

    it("fires a nearer timer a callback schedules during the same advance", () => {
        const sched = fakeScheduler();
        const order: string[] = [];
        sched.after(10, () => {
            order.push("first");
            sched.after(5, () => order.push("second"));
        });

        sched.advance(100);
        expect(order).toEqual(["first", "second"]);
        expect(sched.now()).toBe(100);
    });

    it("cancels a pending timer before it fires", () => {
        const sched = fakeScheduler();
        let fired = false;
        const handle = sched.after(50, () => {
            fired = true;
        });
        sched.cancel(handle);
        sched.advance(100);
        expect(fired).toBe(false);
    });

    it("runs animation frames one batch per call, passing the clock", () => {
        const sched = fakeScheduler();
        const seen: number[] = [];
        sched.advance(30);
        sched.frame((timeMs) => {
            seen.push(timeMs);
            // A frame that re-arms itself runs on the NEXT runFrames, not this one.
            sched.frame((next) => seen.push(next));
        });

        sched.runFrames();
        expect(seen).toEqual([30]);
        expect(sched.pending().frames).toBe(1);
        sched.runFrames();
        expect(seen).toEqual([30, 30]);
    });

    it("cancels a pending frame", () => {
        const sched = fakeScheduler();
        let ran = false;
        const handle = sched.frame(() => {
            ran = true;
        });
        sched.cancelFrame(handle);
        sched.runFrames();
        expect(ran).toBe(false);
    });

    it("starts its clock where asked", () => {
        const sched = fakeScheduler(1000);
        expect(sched.now()).toBe(1000);
        sched.advance(500);
        expect(sched.now()).toBe(1500);
    });
});
