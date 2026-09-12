// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useOwnedStrikes } from "./useOwnedStrikes";

function setup(label = "test") {
    const playNote = vi.fn();
    const silenceStrikes = vi.fn();
    // A fresh synth object on every render, the way a surface rebuilds it.
    const view = renderHook(() => useOwnedStrikes({ playNote, silenceStrikes }, label));
    return { playNote, silenceStrikes, ...view };
}

const ownerOf = (playNote: ReturnType<typeof vi.fn>, call = 0) =>
    (playNote.mock.calls[call]?.[1] as { owner?: symbol } | undefined)?.owner;

describe("useOwnedStrikes", () => {
    it("strikes every note under one owner, with the caller's options", () => {
        const { result, playNote } = setup();
        result.current.playNote(60, { duration: 0.5, velocity: 80 });
        result.current.playNote(64);
        const owner = ownerOf(playNote);
        expect(typeof owner).toBe("symbol");
        expect(playNote).toHaveBeenNthCalledWith(1, 60, { duration: 0.5, velocity: 80, owner });
        expect(playNote).toHaveBeenNthCalledWith(2, 64, { owner });
    });

    it("takes back exactly the notes it struck", () => {
        const { result, playNote, silenceStrikes } = setup();
        result.current.playNote(60);
        result.current.silence();
        expect(silenceStrikes).toHaveBeenCalledWith(ownerOf(playNote));
    });

    it("gives each transport an owner of its own", () => {
        const first = setup("listen");
        const second = setup("duet");
        first.result.current.playNote(60);
        second.result.current.playNote(60);
        expect(ownerOf(first.playNote)).not.toBe(ownerOf(second.playNote));
    });

    it("keeps its owner and its callbacks across a rebuilt synth", () => {
        const { result, playNote, rerender } = setup();
        const before = result.current;
        before.playNote(60);
        rerender();
        result.current.playNote(62);
        expect(result.current.silence).toBe(before.silence);
        expect(result.current.playNote).toBe(before.playNote);
        expect(ownerOf(playNote, 1)).toBe(ownerOf(playNote, 0));
    });
});
