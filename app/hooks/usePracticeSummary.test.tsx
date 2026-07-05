// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { memoryStore } from "../adapters/memoryStore";
import { createHistoryStore } from "../stores/historyStore";
import { ServicesProvider } from "../contexts/services";
import { usePracticeSummary } from "./usePracticeSummary";

// Rendered through the provider over a memory store: the summary must follow
// runs recorded anywhere, not sample the history once at mount.
describe("usePracticeSummary", () => {
    it("updates live when a run is recorded elsewhere in the app", () => {
        const kv = memoryStore();
        const history = createHistoryStore(kv);
        const wrapper = ({ children }: { children: ReactNode }) => (
            <ServicesProvider services={{ store: kv, history }}>{children}</ServicesProvider>
        );
        const { result } = renderHook(() => usePracticeSummary(), { wrapper });
        expect(result.current?.totalNotes).toBe(0);

        act(() => {
            history.record(42);
        });
        expect(result.current?.totalNotes).toBe(42);
        expect(result.current?.daysPracticed).toBe(1);

        act(() => {
            history.record(8);
        });
        expect(result.current?.totalNotes).toBe(50);
    });

    it("summarizes history persisted before mount", () => {
        const kv = memoryStore();
        createHistoryStore(kv).record(100);
        const wrapper = ({ children }: { children: ReactNode }) => (
            <ServicesProvider services={{ store: kv }}>{children}</ServicesProvider>
        );
        const { result } = renderHook(() => usePracticeSummary(), { wrapper });
        expect(result.current?.totalNotes).toBe(100);
        expect(result.current?.recent).toHaveLength(7);
    });
});
