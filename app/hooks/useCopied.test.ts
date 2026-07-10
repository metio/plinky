// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCopied } from "./useCopied";

describe("useCopied", () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });
    afterEach(() => {
        vi.useRealTimers();
    });

    it("starts with nothing copied", () => {
        const { result } = renderHook(() => useCopied());
        expect(result.current[0]).toBeNull();
    });

    it("flashes the default key and reverts after the delay", () => {
        const { result } = renderHook(() => useCopied());
        act(() => result.current[1]());
        expect(result.current[0]).toBe("copied");
        act(() => void vi.advanceTimersByTime(2000));
        expect(result.current[0]).toBeNull();
    });

    it("marks the pressed button's key", () => {
        const { result } = renderHook(() => useCopied());
        act(() => result.current[1]("draft"));
        expect(result.current[0]).toBe("draft");
    });

    it("restarts the revert timer when another key flashes", () => {
        const { result } = renderHook(() => useCopied());
        act(() => result.current[1]("first"));
        act(() => void vi.advanceTimersByTime(1500));
        act(() => result.current[1]("second"));
        act(() => void vi.advanceTimersByTime(1500));
        expect(result.current[0]).toBe("second");
        act(() => void vi.advanceTimersByTime(500));
        expect(result.current[0]).toBeNull();
    });

    it("honours a custom revert delay", () => {
        const { result } = renderHook(() => useCopied(500));
        act(() => result.current[1]());
        act(() => void vi.advanceTimersByTime(499));
        expect(result.current[0]).toBe("copied");
        act(() => void vi.advanceTimersByTime(1));
        expect(result.current[0]).toBeNull();
    });

    it("clears the pending revert on unmount", () => {
        const { result, unmount } = renderHook(() => useCopied());
        act(() => result.current[1]());
        unmount();
        act(() => void vi.runAllTimers());
        expect(vi.getTimerCount()).toBe(0);
    });
});
