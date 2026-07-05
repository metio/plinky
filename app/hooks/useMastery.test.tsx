// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import type { Mastery } from "../../core/mastery";
import { memoryStore } from "../adapters/memoryStore";
import { createMasteryStore } from "../stores/masteryStore";
import { ServicesProvider } from "../contexts/services";
import { useMastery } from "./useMastery";

const mastery = (): Mastery => ({
    bestScore: 82,
    learned: true,
    backlog: false,
    intervalDays: 3,
    reviewAt: 0,
    updatedAt: 0,
});

describe("useMastery", () => {
    it("is null for a score never played, then follows the store when it saves", () => {
        const kv = memoryStore();
        const store = createMasteryStore(kv);
        const wrapper = ({ children }: { children: ReactNode }) => (
            <ServicesProvider services={{ store: kv, mastery: store }}>{children}</ServicesProvider>
        );
        const { result } = renderHook(() => useMastery("minuet"), { wrapper });
        expect(result.current).toBeNull();

        act(() => {
            store.save("minuet", mastery());
        });
        expect(result.current?.bestScore).toBe(82);
    });
});
