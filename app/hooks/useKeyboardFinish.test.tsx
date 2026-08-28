// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { GLOSSY, JOYFUL } from "../../core/keyboardFinish";
import { DEFAULT_THEME, KEYBOARD_THEMES } from "../../core/keyboardTheme";
import { memoryStore } from "../adapters/memoryStore";
import { createServices, ServicesProvider } from "../contexts/services";
import { useKeyboardFinish, useKeyboardTheme } from "./useKeyboardTheme";

const worldWith = (prefs: Record<string, unknown>) => {
    const store = memoryStore();
    const services = createServices({ store });
    services.prefs.save({ ...services.prefs.load(), ...prefs });
    const wrapper = ({ children }: { children: ReactNode }) => (
        <ServicesProvider services={services}>{children}</ServicesProvider>
    );
    return { services, wrapper };
};

describe("useKeyboardFinish", () => {
    it("starts joyful, which is what a new player sees", () => {
        const { wrapper } = worldWith({});
        expect(renderHook(() => useKeyboardFinish(), { wrapper }).result.current).toBe(JOYFUL);
    });

    it("follows the stored choice", () => {
        const { wrapper } = worldWith({ keyboardFinish: "glossy" });
        expect(renderHook(() => useKeyboardFinish(), { wrapper }).result.current).toBe(GLOSSY);
    });

    it("falls back to joyful for a finish this build cannot draw", () => {
        const { wrapper } = worldWith({ keyboardFinish: "holographic" });
        expect(renderHook(() => useKeyboardFinish(), { wrapper }).result.current).toBe(JOYFUL);
    });

    it("hands back the very same object each render, so a keyboard is not re-rendered", () => {
        // The hook snapshots the id and looks the finish up in a constant list. Returning a
        // fresh object would change a prop on every unrelated preference save, and a
        // keyboard re-rendering mid-play is what this shape exists to prevent.
        const { wrapper } = worldWith({ keyboardFinish: "glossy" });
        const { result, rerender } = renderHook(() => useKeyboardFinish(), { wrapper });
        const first = result.current;
        rerender();
        expect(result.current).toBe(first);
    });

    it("does not change when an unrelated preference is saved", () => {
        const { services, wrapper } = worldWith({ keyboardFinish: "glossy" });
        const { result } = renderHook(() => useKeyboardFinish(), { wrapper });
        const before = result.current;
        services.prefs.save({ ...services.prefs.load(), volume: 0.3 });
        expect(result.current).toBe(before);
    });

    it("is independent of the colour skin — the two are separate questions", () => {
        const berry = KEYBOARD_THEMES.find((theme) => theme.id === "berry")!;
        const { wrapper } = worldWith({ keyboardTheme: "berry", keyboardFinish: "glossy" });
        const finish = renderHook(() => useKeyboardFinish(), { wrapper });
        const theme = renderHook(() => useKeyboardTheme(), { wrapper });
        expect(finish.result.current).toBe(GLOSSY);
        expect(theme.result.current).toBe(berry);
        expect(theme.result.current).not.toBe(DEFAULT_THEME);
    });
});
