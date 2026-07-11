// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Bar } from "../../core/scoreToBars";
import { useBarWindow } from "./useBarWindow";

// Four one-position bars, each holding a single identifiable pitch.
const BARS: Bar[] = [[[60]], [[62]], [[64]], [[65]]];

describe("useBarWindow", () => {
    it("opens at the top and walks forward and back within bounds", () => {
        const { result } = renderHook(() => useBarWindow(BARS, 2));
        expect(result.current.start).toBe(0);
        expect(result.current.end).toBe(2);
        expect(result.current.canPrev).toBe(false);
        expect(result.current.positions).toEqual([[60], [62]]);

        act(() => result.current.next());
        act(() => result.current.next());
        expect(result.current.start).toBe(2);
        expect(result.current.canNext).toBe(false);
        // A further step holds at the last full window.
        act(() => result.current.next());
        expect(result.current.start).toBe(2);

        act(() => result.current.prev());
        expect(result.current.positions).toEqual([[62], [64]]);
    });

    it("carries the cells that map window positions back to bar coordinates", () => {
        const { result } = renderHook(() => useBarWindow(BARS, 2));
        act(() => result.current.next());
        expect(result.current.cells).toEqual([
            { bar: 1, pos: 0 },
            { bar: 2, pos: 0 },
        ]);
    });

    it("clamps when the bars shrink under the window (a hand with fewer bars)", () => {
        const { result, rerender } = renderHook(({ bars }) => useBarWindow(bars, 2), {
            initialProps: { bars: BARS },
        });
        act(() => result.current.next());
        act(() => result.current.next());
        expect(result.current.start).toBe(2);
        rerender({ bars: BARS.slice(0, 2) });
        expect(result.current.start).toBe(0);
        expect(result.current.end).toBe(2);
    });

    it("survives a piece shorter than the window", () => {
        const { result } = renderHook(() => useBarWindow(BARS.slice(0, 1), 2));
        expect(result.current.start).toBe(0);
        expect(result.current.end).toBe(1);
        expect(result.current.canNext).toBe(false);
        expect(result.current.positions).toEqual([[60]]);
    });
});
