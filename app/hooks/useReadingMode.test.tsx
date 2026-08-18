// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { memoryStore } from "../adapters/memoryStore";
import { ServicesProvider } from "../contexts/services";
import { createPrefsStore } from "../stores/prefsStore";
import { useReadingMode } from "./useReadingMode";

// A services world over an in-memory store, so the persisted toggles have a real prefs
// store to read and write. Returns the prefs store too, to seed and inspect it directly.
const world = () => {
    const kv = memoryStore();
    const prefs = createPrefsStore(kv);
    const wrapper = ({ children }: { children: ReactNode }) => (
        <ServicesProvider services={{ store: kv, prefs }}>{children}</ServicesProvider>
    );
    return { prefs, wrapper };
};

describe("useReadingMode", () => {
    it("follows the flow toggles' defaults — scroll-follow on, fingering on", () => {
        // Fingering is one of the reading aids now, so it starts where the rest of the
        // starter rung does: on, for a beginner to shed rather than to find.
        const { wrapper } = world();
        const { result } = renderHook(() => useReadingMode(), { wrapper });
        expect(result.current.scrollFollow).toBe(true);
        expect(result.current.showFingerings).toBe(true);
    });

    it("seeds the on-staff fingering from the saved default", () => {
        const { prefs, wrapper } = world();
        prefs.save({ ...prefs.load(), showFingerings: false });
        const { result } = renderHook(() => useReadingMode(), { wrapper });
        expect(result.current.showFingerings).toBe(false);
    });

    it("persists the layout toggles to the prefs store", () => {
        const { prefs, wrapper } = world();
        const { result } = renderHook(() => useReadingMode(), { wrapper });
        act(() => {
            result.current.setTreadmill(true);
            result.current.setBarNumbers(true);
            result.current.setBarsPerRow(4);
        });
        expect(result.current.treadmill).toBe(true);
        expect(result.current.barNumbers).toBe(true);
        expect(result.current.barsPerRow).toBe(4);
        expect(prefs.load().treadmill).toBe(true);
        expect(prefs.load().barNumbers).toBe(true);
        expect(prefs.load().barsPerRow).toBe(4);
    });

    it("flips the in-play fingering toggle without touching the saved default", () => {
        const { prefs, wrapper } = world();
        const { result } = renderHook(() => useReadingMode(), { wrapper });
        act(() => result.current.setShowFingerings((on) => !on));
        expect(result.current.showFingerings).toBe(false);
        // Session-only: the saved default stays as it was.
        expect(prefs.load().showFingerings).toBe(true);
    });
});
