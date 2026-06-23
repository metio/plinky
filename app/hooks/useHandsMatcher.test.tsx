// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Hand } from "../lib/hands";
import { type CorrectInfo, describeNext, useHandsMatcher } from "./useHandsMatcher";

function step(pitches: number[]) {
    return { pitches, timeMs: 0, elements: [] as HTMLElement[] };
}

const twoHands: Hand[] = [
    { staff: 0, label: "Right", steps: [step([72]), step([74])] },
    { staff: 1, label: "Left", steps: [step([60])] },
];

describe("useHandsMatcher", () => {
    it("tracks completed steps against the total across hands", () => {
        const { result } = renderHook(() => useHandsMatcher(twoHands));
        expect(result.current.totalSteps).toBe(3);
        expect(result.current.completedSteps).toBe(0);
        act(() => result.current.registerNote(72, 1));
        expect(result.current.completedSteps).toBe(1);
    });

    it("fires onCorrect per hand with a running ordinal, then onComplete", () => {
        const correct: CorrectInfo[] = [];
        const onComplete = vi.fn();
        const { result } = renderHook(() =>
            useHandsMatcher(twoHands, { onCorrect: (info) => correct.push(info), onComplete }),
        );
        act(() => result.current.registerNote(72, 1));
        act(() => result.current.registerNote(60, 2));
        act(() => result.current.registerNote(74, 3));
        expect(correct.map((info) => [info.hand, info.ordinal])).toEqual([
            [0, 0],
            [1, 1],
            [0, 2],
        ]);
        expect(onComplete).toHaveBeenCalledOnce();
        expect(result.current.done).toBe(true);
    });

    it("flashes a note no hand expects", () => {
        const onWrong = vi.fn();
        const { result } = renderHook(() => useHandsMatcher(twoHands, { onWrong }));
        act(() => result.current.registerNote(99, 1));
        expect(result.current.wrongNote).toBe(99);
        expect(onWrong).toHaveBeenCalledWith(99, 1);
    });

    it("ignores input while inactive", () => {
        const onCorrect = vi.fn();
        const { result } = renderHook(() =>
            useHandsMatcher(twoHands, { active: false, onCorrect }),
        );
        act(() => result.current.registerNote(72, 1));
        expect(onCorrect).not.toHaveBeenCalled();
        expect(result.current.completedSteps).toBe(0);
    });

    it("does not crash when hands appear after an empty first render", () => {
        // The score renders empty, then buildHands fills it in. The state reset
        // runs in an effect, so the render right after the hands grow must not
        // dereference a hand the state does not have yet.
        const { result, rerender } = renderHook(
            ({ hands }) => useHandsMatcher(hands, { active: false }),
            { initialProps: { hands: [] as Hand[] } },
        );
        rerender({ hands: [{ staff: 0, label: "Right", steps: [step([60])] }] });
        expect(result.current.nextByHand).toEqual([{ label: "Right", pitches: [60] }]);
    });
});

describe("describeNext", () => {
    const name = (note: number) => String(note);

    it("shows bare pitches for a single hand", () => {
        expect(describeNext([{ label: "Right", pitches: [60, 64] }], name)).toBe("60 64");
    });

    it("labels each hand when both are playing", () => {
        expect(
            describeNext(
                [
                    { label: "Right", pitches: [72] },
                    { label: "Left", pitches: [48] },
                ],
                name,
            ),
        ).toBe("Right: 72 · Left: 48");
    });
});
