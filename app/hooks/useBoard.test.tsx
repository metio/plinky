// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import type { BoardArtist } from "../../core/board";
import { fakeBoard } from "../adapters/fakeBoard";
import { ServicesProvider } from "../contexts/services";
import type { BoardSource } from "../ports/board";
import { useBoard } from "./useBoard";

const artist: BoardArtist = { id: "a1", name: "Ada Keys", order: 0, text: "Plays daily." };

function wrapper(board: BoardSource) {
    return ({ children }: { children: ReactNode }) => (
        <ServicesProvider services={{ board }}>{children}</ServicesProvider>
    );
}

describe("useBoard", () => {
    it("starts loading, then resolves to the artists", async () => {
        const { result } = renderHook(() => useBoard("en"), {
            wrapper: wrapper(fakeBoard([artist])),
        });
        expect(result.current.loading).toBe(true);
        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(result.current.artists).toEqual([artist]);
    });

    it("resolves to an empty list when the source throws", async () => {
        const failing: BoardSource = { fetchArtists: async () => Promise.reject(new Error("x")) };
        const { result } = renderHook(() => useBoard("en"), { wrapper: wrapper(failing) });
        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(result.current.artists).toEqual([]);
    });
});
