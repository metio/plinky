// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { memoryStore } from "../adapters/memoryStore";
import { createServices, ServicesProvider } from "../contexts/services";
import { usePref } from "./usePref";

type Wrapper = ({ children }: { children: ReactNode }) => ReactNode;

function world() {
    const services = createServices({ store: memoryStore() });
    const wrapper = ({ children }: { children: ReactNode }) => (
        <ServicesProvider services={services}>{children}</ServicesProvider>
    );
    return { services, wrapper };
}

const bind = (key: "treadmill" | "barNumbers", wrapper: Wrapper) =>
    renderHook(() => usePref(key), { wrapper });

describe("usePref", () => {
    it("reads the stored value and persists every change", () => {
        const { services, wrapper } = world();
        const { result } = bind("treadmill", wrapper);
        expect(result.current[0]).toBe(services.prefs.load().treadmill);

        act(() => result.current[1](true));

        expect(result.current[0]).toBe(true);
        expect(services.prefs.load().treadmill).toBe(true);
    });

    it("carries the other preferences through, so bound keys never clobber each other", () => {
        const { services, wrapper } = world();
        const treadmill = bind("treadmill", wrapper);
        const barNumbers = bind("barNumbers", wrapper);

        act(() => treadmill.result.current[1](true));
        act(() => barNumbers.result.current[1](true));

        expect(services.prefs.load().treadmill).toBe(true);
        expect(services.prefs.load().barNumbers).toBe(true);
    });

    it("follows a change made somewhere else", () => {
        // The bug this hook had. The same preference is edited from more than one place
        // — the quick controls above the keys, the tools drawer, Settings — and a
        // component that seeded a copy at mount could not see any of them. It went
        // unnoticed because the play surface re-rendered continuously for unrelated
        // reasons and picked the value up within a frame.
        const { services, wrapper } = world();
        const { result } = bind("treadmill", wrapper);
        expect(result.current[0]).toBe(false);

        act(() => {
            services.prefs.save({ ...services.prefs.load(), treadmill: true });
        });

        expect(result.current[0]).toBe(true);
    });

    it("shows two bindings of the same key the same value", () => {
        // Two doors onto one preference, which is what the quick controls and Settings
        // already claim to be.
        const { wrapper } = world();
        const quickControls = bind("treadmill", wrapper);
        const settings = bind("treadmill", wrapper);

        act(() => settings.result.current[1](true));

        expect(quickControls.result.current[0]).toBe(true);
    });
});
