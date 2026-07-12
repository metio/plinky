// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Composition } from "../../core/composition";
import { useStaffSketch } from "./useStaffSketch";

const TAKE: Composition = {
    notes: [{ pitch: 60, startMs: 0, durationMs: 400, velocity: 90 }],
    tempo: 120,
    beatsPerBar: 4,
};

describe("useStaffSketch", () => {
    it("stays empty for an empty take", () => {
        const { result } = renderHook(() =>
            useStaffSketch({ ...TAKE, notes: [] }, "Improvisation", true),
        );
        expect(result.current).toBeNull();
    });

    it("engraves the take after the debounce, carrying the title", async () => {
        const { result } = renderHook(() => useStaffSketch(TAKE, "My Tune", true));
        // The sketch waits a beat so a fast passage doesn't thrash the renderer.
        expect(result.current).toBeNull();
        await waitFor(() => expect(result.current).toContain("<score-partwise"));
        expect(result.current).toContain("My Tune");
    });

    it("clears again when the take empties", async () => {
        const { result, rerender } = renderHook(
            ({ take }: { take: Composition }) => useStaffSketch(take, "My Tune", true),
            { initialProps: { take: TAKE } },
        );
        await waitFor(() => expect(result.current).not.toBeNull());
        rerender({ take: { ...TAKE, notes: [] } });
        expect(result.current).toBeNull();
    });
});
