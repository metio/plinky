// SPDX-FileCopyrightText: The Klimpi Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { NO_QUERY, useHydrated } from "./useHydrated";

describe("useHydrated", () => {
    it("reads false on the render that hydrates and true after it", () => {
        const seen: boolean[] = [];

        const { result } = renderHook(() => {
            const hydrated = useHydrated();
            seen.push(hydrated);
            return hydrated;
        });

        // The first render is the one that has to match the document the server wrote.
        expect(seen[0]).toBe(false);
        expect(result.current).toBe(true);
    });

    it("stays true once it is, so Back still reads the address", () => {
        const { result, rerender } = renderHook(() => useHydrated());

        act(() => {
            rerender();
        });

        expect(result.current).toBe(true);
    });

    it("offers an empty address to render the document's own view", () => {
        expect(NO_QUERY.get("exercise")).toBeNull();
        expect([...NO_QUERY.keys()]).toEqual([]);
    });
});
