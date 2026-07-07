// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { memoryStore } from "../adapters/memoryStore";
import { createPrefsStore } from "../stores/prefsStore";
import { usePref } from "./usePref";

describe("usePref", () => {
    it("seeds from the store and persists every change", () => {
        const store = createPrefsStore(memoryStore());
        const { result } = renderHook(() => usePref(store, "treadmill"));
        expect(result.current[0]).toBe(store.load().treadmill);

        act(() => result.current[1](true));
        expect(result.current[0]).toBe(true);
        expect(store.load().treadmill).toBe(true);
    });

    it("carries the other preferences through, so bound keys never clobber each other", () => {
        const store = createPrefsStore(memoryStore());
        const treadmill = renderHook(() => usePref(store, "treadmill"));
        const barNumbers = renderHook(() => usePref(store, "barNumbers"));

        act(() => treadmill.result.current[1](true));
        act(() => barNumbers.result.current[1](true));

        expect(store.load().treadmill).toBe(true);
        expect(store.load().barNumbers).toBe(true);
    });
});
