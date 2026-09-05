// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useSeededState } from "./useSeededState";

const seedOf = (seed: string | null) => seed ?? "first";

describe("useSeededState", () => {
    it("starts from the seed and follows a choice made on the page", () => {
        const { result } = renderHook(() => useSeededState("slur", seedOf));
        expect(result.current[0]).toBe("slur");
        act(() => result.current[1]("accent"));
        expect(result.current[0]).toBe("accent");
    });

    it("follows the seed when it moves under a choice, as history navigation does", () => {
        const view = renderHook(
            ({ seed }: { seed: string | null }) => useSeededState(seed, seedOf),
            {
                initialProps: { seed: "slur" as string | null },
            },
        );
        act(() => view.result.current[1]("accent"));
        view.rerender({ seed: "staccato" });
        expect(view.result.current[0]).toBe("staccato");
        view.rerender({ seed: null });
        expect(view.result.current[0]).toBe("first");
    });

    it("keeps a choice made under a seed for as long as that seed stands", () => {
        const view = renderHook(
            ({ seed }: { seed: string | null }) => useSeededState(seed, seedOf),
            {
                initialProps: { seed: null as string | null },
            },
        );
        act(() => view.result.current[1]("accent"));
        view.rerender({ seed: null });
        expect(view.result.current[0]).toBe("accent");
    });
});
