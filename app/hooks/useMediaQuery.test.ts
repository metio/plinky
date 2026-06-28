// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useMediaQuery } from "./useMediaQuery";

afterEach(() => vi.unstubAllGlobals());

function stubMatchMedia(matches: boolean): void {
    vi.stubGlobal("matchMedia", () => ({
        matches,
        addEventListener() {},
        removeEventListener() {},
    }));
}

describe("useMediaQuery", () => {
    it("reflects a matching query after mount", () => {
        stubMatchMedia(true);
        const { result } = renderHook(() => useMediaQuery("(max-width: 639px)"));
        expect(result.current).toBe(true);
    });

    it("is false when the query doesn't match", () => {
        stubMatchMedia(false);
        const { result } = renderHook(() => useMediaQuery("(max-width: 639px)"));
        expect(result.current).toBe(false);
    });
});
