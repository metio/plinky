// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { MilestoneProvider, useMilestoneChannel } from "./milestone";

describe("milestone channel", () => {
    it("publishes an earned moment for the shell banner to read, then clears it on dismiss", () => {
        const wrapper = ({ children }: { children: ReactNode }) => (
            <MilestoneProvider>{children}</MilestoneProvider>
        );
        const { result } = renderHook(() => useMilestoneChannel(), { wrapper });
        expect(result.current.current).toBeNull();

        act(() => {
            result.current.publish({ kind: "flawless", songTitle: "Minuet" });
        });
        expect(result.current.current).toEqual({ kind: "flawless", songTitle: "Minuet" });

        act(() => {
            result.current.dismiss();
        });
        expect(result.current.current).toBeNull();
    });

    it("holds only the latest earned moment, so a second run replaces the first", () => {
        const wrapper = ({ children }: { children: ReactNode }) => (
            <MilestoneProvider>{children}</MilestoneProvider>
        );
        const { result } = renderHook(() => useMilestoneChannel(), { wrapper });

        act(() => {
            result.current.publish({ kind: "first-s", songTitle: "Minuet" });
        });
        act(() => {
            result.current.publish({ kind: "grade-up", grade: 3, skill: 1200 });
        });
        expect(result.current.current).toEqual({ kind: "grade-up", grade: 3, skill: 1200 });
    });

    it("no-ops outside a provider, so a ScoreViewer mounted bare never throws", () => {
        const { result } = renderHook(() => useMilestoneChannel());
        expect(result.current.current).toBeNull();
        expect(() =>
            act(() => {
                result.current.publish({ kind: "first-s", songTitle: "Minuet" });
            }),
        ).not.toThrow();
        expect(result.current.current).toBeNull();
    });
});
