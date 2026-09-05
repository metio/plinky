// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { DEFAULT_PREFS } from "../../core/prefs";
import { memoryStore } from "../adapters/memoryStore";
import { ServicesProvider } from "../contexts/services";
import { createPrefsStore } from "../stores/prefsStore";
import { useUnaidedServices } from "./useUnaidedServices";

describe("useUnaidedServices", () => {
    it("fixes the reading aids off and leaves the player's own preferences untouched", () => {
        const store = memoryStore();
        const prefs = createPrefsStore(store);
        prefs.save({ ...DEFAULT_PREFS, noteLabels: "all", colorNotes: true, sound: false });
        const wrapper = ({ children }: { children: ReactNode }) => (
            <ServicesProvider services={{ store, prefs }}>{children}</ServicesProvider>
        );
        const { result, rerender } = renderHook(() => useUnaidedServices(), { wrapper });
        const fixed = result.current.prefs.load();
        expect(fixed.colorNotes).toBe(false);
        expect(fixed.sound).toBe(false);
        expect(prefs.load().colorNotes).toBe(true);
        // Fixed: a save into the unaided store changes nothing the player set.
        result.current.prefs.save({ ...fixed, colorNotes: true });
        expect(result.current.prefs.load().colorNotes).toBe(false);
        const before = result.current;
        rerender();
        expect(result.current).toBe(before);
    });
});
