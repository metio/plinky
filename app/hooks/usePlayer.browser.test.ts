// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { usePlayer } from "./usePlayer";

// abcjs only populates playable pitches in a real browser, so this runs in the
// browser project.
const ABC = "X:1\nT:Test\nM:4/4\nL:1/4\nK:C\nC D E F | G A B c |";

describe("usePlayer", () => {
    it("enters the playing state for a song and clears it on stop", async () => {
        const { result } = renderHook(() => usePlayer());
        expect(result.current.playingId).toBeNull();

        await act(async () => {
            await result.current.play("test-song", ABC, 120);
        });
        expect(result.current.playingId).toBe("test-song");

        act(() => result.current.stop());
        expect(result.current.playingId).toBeNull();
    });

    it("does not start when there are no playable notes", async () => {
        const { result } = renderHook(() => usePlayer());
        await act(async () => {
            // Valid headers but an empty tune body — nothing to schedule.
            await result.current.play("empty", "X:1\nT:Empty\nM:4/4\nL:1/4\nK:C\n", 100);
        });
        expect(result.current.playingId).toBeNull();
    });
});
