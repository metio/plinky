// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { useRef } from "react";
import { describe, expect, it, vi } from "vitest";

import { useFullscreen } from "./useFullscreen";

describe("useFullscreen", () => {
    it("enters full screen and asks the element to fill the screen", () => {
        const element = document.createElement("div");
        element.requestFullscreen = vi.fn().mockResolvedValue(undefined);
        const { result } = renderHook(() => {
            const ref = useRef<HTMLDivElement>(element);
            return useFullscreen(ref);
        });

        expect(result.current.fullscreen).toBe(false);
        act(() => result.current.enter());
        expect(result.current.fullscreen).toBe(true);
        expect(element.requestFullscreen).toHaveBeenCalled();
    });

    it("follows the browser leaving full screen on its own", () => {
        const element = document.createElement("div");
        element.requestFullscreen = vi.fn().mockResolvedValue(undefined);
        const { result } = renderHook(() => {
            const ref = useRef<HTMLDivElement>(element);
            return useFullscreen(ref);
        });

        act(() => result.current.enter());
        expect(result.current.fullscreen).toBe(true);
        // The browser exits (Esc / system gesture): document.fullscreenElement is null.
        act(() => document.dispatchEvent(new Event("fullscreenchange")));
        expect(result.current.fullscreen).toBe(false);
    });
});
