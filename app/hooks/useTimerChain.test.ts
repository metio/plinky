// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useTimerChain } from "./useTimerChain";

beforeEach(() => {
    vi.useFakeTimers();
});

afterEach(() => {
    vi.useRealTimers();
});

describe("useTimerChain", () => {
    it("runs a self-re-arming chain link by link", () => {
        const { result } = renderHook(() => useTimerChain());
        const ticks: number[] = [];
        const tick = (n: number) => {
            ticks.push(n);
            if (n < 3) {
                result.current.push(() => tick(n + 1), 100);
            }
        };
        result.current.push(() => tick(1), 100);
        vi.advanceTimersByTime(350);
        expect(ticks).toEqual([1, 2, 3]);
    });

    it("clear cancels every pending link and is idempotent", () => {
        const { result } = renderHook(() => useTimerChain());
        const fired = vi.fn();
        result.current.push(fired, 100);
        result.current.push(fired, 200);
        result.current.clear();
        result.current.clear();
        vi.advanceTimersByTime(500);
        expect(fired).not.toHaveBeenCalled();
    });

    it("unmount clears whatever is still pending, so no loop outlives the surface", () => {
        const { result, unmount } = renderHook(() => useTimerChain());
        const fired = vi.fn();
        result.current.push(fired, 100);
        unmount();
        vi.advanceTimersByTime(500);
        expect(fired).not.toHaveBeenCalled();
    });

    it("two chains stop independently", () => {
        const { result } = renderHook(() => ({ a: useTimerChain(), b: useTimerChain() }));
        const firedA = vi.fn();
        const firedB = vi.fn();
        result.current.a.push(firedA, 100);
        result.current.b.push(firedB, 100);
        result.current.a.clear();
        vi.advanceTimersByTime(200);
        expect(firedA).not.toHaveBeenCalled();
        expect(firedB).toHaveBeenCalledOnce();
    });
});
