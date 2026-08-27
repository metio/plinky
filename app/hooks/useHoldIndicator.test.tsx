// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { memoryStore } from "../adapters/memoryStore";
import { createServices, ServicesProvider } from "../contexts/services";
import { fakeScheduler } from "../testing/fakeScheduler";
import { useHoldIndicator } from "./useHoldIndicator";

function harness() {
    const scheduler = fakeScheduler();
    const services = createServices({ store: memoryStore(), scheduler });
    const wrapper = ({ children }: { children: ReactNode }) => (
        <ServicesProvider services={services}>{children}</ServicesProvider>
    );
    return { scheduler, ...renderHook(() => useHoldIndicator(), { wrapper }) };
}

// Move the clock and let the re-arming frame loop run one paint.
function paint(scheduler: ReturnType<typeof fakeScheduler>, ms: number) {
    act(() => {
        scheduler.advance(ms);
        scheduler.runFrames();
    });
}

describe("useHoldIndicator", () => {
    it("fills a note to full at the strike and drains it to gone over its length", () => {
        const { scheduler, result } = harness();

        act(() => result.current.begin([{ note: 60, durationMs: 1000 }]));
        expect(result.current.holds.get().get(60)).toBe(1);

        paint(scheduler, 500);
        expect(result.current.holds.get().get(60)).toBeCloseTo(0.5);

        paint(scheduler, 500);
        expect(result.current.holds.get().has(60)).toBe(false);
        // The loop stopped re-arming once nothing was left to shrink.
        expect(scheduler.pending().frames).toBe(0);
    });

    it("arms a fill per pitch of a chord", () => {
        const { result } = harness();
        act(() =>
            result.current.begin([
                { note: 60, durationMs: 800 },
                { note: 64, durationMs: 800 },
                { note: 67, durationMs: 800 },
            ]),
        );
        expect(result.current.holds.get().get(60)).toBe(1);
        expect(result.current.holds.get().get(64)).toBe(1);
        expect(result.current.holds.get().get(67)).toBe(1);
    });

    it("drains each key on its own written length, not the position's longest", () => {
        const { scheduler, result } = harness();
        // The ordinary two-hand case: a whole note under a quaver. One length for the
        // whole position would leave the quaver's fill draining at the slow hand's pace
        // long after that hand had moved on.
        act(() =>
            result.current.begin([
                { note: 48, durationMs: 2000 },
                { note: 72, durationMs: 250 },
            ]),
        );

        paint(scheduler, 250);
        expect(result.current.holds.get().has(72)).toBe(false);
        expect(result.current.holds.get().get(48)).toBeCloseTo(0.875);
        // The long hand keeps its own frame loop running.
        expect(scheduler.pending().frames).toBe(1);
    });

    it("skips a key with no length and still arms the ones that have it", () => {
        const { result } = harness();
        act(() =>
            result.current.begin([
                { note: 60, durationMs: 0 },
                { note: 64, durationMs: 500 },
            ]),
        );
        expect(result.current.holds.get().has(60)).toBe(false);
        expect(result.current.holds.get().get(64)).toBe(1);
    });

    it("re-arms a note's fill to its full length when it is struck again", () => {
        const { scheduler, result } = harness();
        act(() => result.current.begin([{ note: 60, durationMs: 1000 }]));
        paint(scheduler, 800);
        expect(result.current.holds.get().get(60)).toBeCloseTo(0.2);

        act(() => result.current.begin([{ note: 60, durationMs: 1000 }]));
        expect(result.current.holds.get().get(60)).toBe(1);
    });

    it("ignores a non-positive duration", () => {
        const { scheduler, result } = harness();
        act(() => result.current.begin([{ note: 60, durationMs: 0 }]));
        expect(result.current.holds.get().has(60)).toBe(false);
        expect(scheduler.pending().frames).toBe(0);
    });

    it("clear drops every fill and cancels the frame loop", () => {
        const { scheduler, result } = harness();
        act(() =>
            result.current.begin([
                { note: 60, durationMs: 1000 },
                { note: 64, durationMs: 1000 },
            ]),
        );
        expect(scheduler.pending().frames).toBe(1);

        act(() => result.current.clear());
        expect(result.current.holds.get().size).toBe(0);
        expect(scheduler.pending().frames).toBe(0);
    });

    it("leaves no frame armed after unmount", () => {
        const { scheduler, result, unmount } = harness();
        act(() => result.current.begin([{ note: 60, durationMs: 1000 }]));
        expect(scheduler.pending().frames).toBe(1);
        unmount();
        expect(scheduler.pending().frames).toBe(0);
    });

    it("tells subscribers on every frame, and lets them go", () => {
        // The whole point of publishing rather than holding state: the fills reach the
        // one component that paints them without re-rendering whoever called the hook.
        const { scheduler, result } = harness();
        let told = 0;
        let stop = () => {};
        act(() => {
            stop = result.current.holds.subscribe(() => {
                told += 1;
            });
        });

        act(() => result.current.begin([{ note: 60, durationMs: 1000 }]));
        expect(told).toBe(1);

        paint(scheduler, 250);
        expect(told).toBe(2);

        act(() => stop());
        paint(scheduler, 250);
        expect(told).toBe(2);
    });

    it("hands back the same empty map rather than a fresh one", () => {
        // useSyncExternalStore compares snapshots by identity, so an idle keyboard
        // publishing a new empty map every frame would re-render forever.
        const { scheduler, result } = harness();
        const before = result.current.holds.get();

        act(() => result.current.clear());
        paint(scheduler, 100);

        expect(result.current.holds.get()).toBe(before);
    });

    it("keeps one stable feed across re-renders", () => {
        // It goes into the play session's context value; a new object each render would
        // put the churn back that moving it out was meant to remove.
        const { result, rerender } = harness();
        const feed = result.current.holds;

        rerender();

        expect(result.current.holds).toBe(feed);
    });
});
