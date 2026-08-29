// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import { renderHook } from "@testing-library/react";
import type { OpenSheetMusicDisplay } from "opensheetmusicdisplay";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { fakeSampleSource } from "../adapters/fakeSampleSource";
import { ServicesProvider } from "../contexts/services";
import { useSamplePrefetch } from "./useSamplePrefetch";

const world = (samples: ReturnType<typeof fakeSampleSource>) => {
    const wrapper = ({ children }: { children: ReactNode }) => (
        <ServicesProvider services={{ samples }}>{children}</ServicesProvider>
    );
    return wrapper;
};

describe("useSamplePrefetch", () => {
    it("asks for nothing while the recordings are switched off", () => {
        // A player on the synthesised piano never pays for the recorded one — not a byte,
        // not a request.
        const samples = fakeSampleSource(null);
        const { result } = renderHook(() => useSamplePrefetch({ getOsmd: () => null }), {
            wrapper: world(samples),
        });
        result.current();
        expect(samples.prepared).toEqual([]);
    });

    it("asks for nothing when there is no engraving to read", () => {
        const samples = fakeSampleSource(null);
        const { result } = renderHook(() => useSamplePrefetch({ getOsmd: () => null }), {
            wrapper: world(samples),
        });
        result.current();
        expect(samples.prepared).toEqual([]);
    });

    it("is a call rather than an effect, so nothing fires until a render says so", async () => {
        // The whole reliability of this. An effect watching a render counter has to catch a
        // state TRANSITION, and one that checks a condition and returns early has thrown
        // that transition away — the counter does not rise again until the next render, so
        // that engraving is never fetched for. Mounting must therefore fetch NOTHING on its
        // own: the fetch belongs to the render finishing, and the render says so.
        const samples = fakeSampleSource(null);
        await samples.enable();
        const { result } = renderHook(() => useSamplePrefetch({ getOsmd: () => null }), {
            wrapper: world(samples),
        });
        expect(samples.prepared).toEqual([]);
        expect(typeof result.current).toBe("function");
    });

    it("keeps the same callback across renders, so a caller may hold it in a ref", () => {
        const samples = fakeSampleSource(null);
        const getOsmd = () => null as OpenSheetMusicDisplay | null;
        const { result, rerender } = renderHook(() => useSamplePrefetch({ getOsmd }), {
            wrapper: world(samples),
        });
        const first = result.current;
        rerender();
        expect(result.current).toBe(first);
    });
});
