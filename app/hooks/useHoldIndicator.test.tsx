// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
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

        act(() => result.current.begin([60], 1000));
        expect(result.current.holdFractions.get(60)).toBe(1);

        paint(scheduler, 500);
        expect(result.current.holdFractions.get(60)).toBeCloseTo(0.5);

        paint(scheduler, 500);
        expect(result.current.holdFractions.has(60)).toBe(false);
        // The loop stopped re-arming once nothing was left to shrink.
        expect(scheduler.pending().frames).toBe(0);
    });

    it("arms a fill per pitch of a chord", () => {
        const { result } = harness();
        act(() => result.current.begin([60, 64, 67], 800));
        expect(result.current.holdFractions.get(60)).toBe(1);
        expect(result.current.holdFractions.get(64)).toBe(1);
        expect(result.current.holdFractions.get(67)).toBe(1);
    });

    it("re-arms a note's fill to its full length when it is struck again", () => {
        const { scheduler, result } = harness();
        act(() => result.current.begin([60], 1000));
        paint(scheduler, 800);
        expect(result.current.holdFractions.get(60)).toBeCloseTo(0.2);

        act(() => result.current.begin([60], 1000));
        expect(result.current.holdFractions.get(60)).toBe(1);
    });

    it("ignores a non-positive duration", () => {
        const { scheduler, result } = harness();
        act(() => result.current.begin([60], 0));
        expect(result.current.holdFractions.has(60)).toBe(false);
        expect(scheduler.pending().frames).toBe(0);
    });

    it("clear drops every fill and cancels the frame loop", () => {
        const { scheduler, result } = harness();
        act(() => result.current.begin([60, 64], 1000));
        expect(scheduler.pending().frames).toBe(1);

        act(() => result.current.clear());
        expect(result.current.holdFractions.size).toBe(0);
        expect(scheduler.pending().frames).toBe(0);
    });

    it("leaves no frame armed after unmount", () => {
        const { scheduler, result, unmount } = harness();
        act(() => result.current.begin([60], 1000));
        expect(scheduler.pending().frames).toBe(1);
        unmount();
        expect(scheduler.pending().frames).toBe(0);
    });
});
