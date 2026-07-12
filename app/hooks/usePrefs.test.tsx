// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { act, cleanup, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { memoryStore } from "../adapters/memoryStore";
import { createServices, ServicesProvider } from "../contexts/services";
import { DEFAULT_PREFS } from "../../core/prefs";
import { createActivitySignal } from "../lib/activity";
import { usePrefs } from "./usePrefs";

afterEach(cleanup);

const world = () => {
    const services = createServices({
        store: memoryStore(),
        activity: createActivitySignal(),
    });
    const wrapper = ({ children }: { children: ReactNode }) => (
        <ServicesProvider services={services}>{children}</ServicesProvider>
    );
    return { services, wrapper };
};

describe("usePrefs", () => {
    it("starts from the stored prefs and persists a partial update", () => {
        const { services, wrapper } = world();
        const { result } = renderHook(() => usePrefs(), { wrapper });

        expect(result.current.prefs).toEqual(DEFAULT_PREFS);

        let verdict = false;
        act(() => {
            verdict = result.current.update({ volume: 30 });
        });
        expect(verdict).toBe(true);
        expect(result.current.prefs.volume).toBe(30);
        expect(services.prefs.load().volume).toBe(30);
    });

    it("merges onto the latest stored prefs, not a stale snapshot", () => {
        const { services, wrapper } = world();
        const { result } = renderHook(() => usePrefs(), { wrapper });

        // Another panel saves independently between this hook's renders.
        act(() => {
            services.prefs.save({
                ...services.prefs.load(),
                handSpan: { left: 9, right: null },
            });
        });
        act(() => {
            result.current.update({ sound: false });
        });

        const stored = services.prefs.load();
        expect(stored.sound).toBe(false);
        expect(stored.handSpan).toEqual({ left: 9, right: null });
    });

    it("re-renders when the store changes from outside the hook", () => {
        const { services, wrapper } = world();
        const { result } = renderHook(() => usePrefs(), { wrapper });

        act(() => {
            services.prefs.save({ ...services.prefs.load(), reviewCap: 20 });
        });
        expect(result.current.prefs.reviewCap).toBe(20);
    });

    it("reports a refused write instead of pretending it landed", () => {
        const refusing = { ...memoryStore(), set: () => false };
        const services = createServices({
            store: refusing,
            activity: createActivitySignal(),
        });
        const wrapper = ({ children }: { children: ReactNode }) => (
            <ServicesProvider services={services}>{children}</ServicesProvider>
        );
        const { result } = renderHook(() => usePrefs(), { wrapper });

        let verdict = true;
        act(() => {
            verdict = result.current.update({ volume: 10 });
        });
        expect(verdict).toBe(false);
    });
});
