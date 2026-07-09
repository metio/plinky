// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import type { HelpItem } from "../../core/help";
import { fakeHelp } from "../adapters/fakeHelp";
import { ServicesProvider } from "../contexts/services";
import type { HelpSource } from "../ports/help";
import { useHelp } from "./useHelp";

const item: HelpItem = { id: "h1", pageKey: "play", order: 0, text: "Play a note." };

function wrapper(help: HelpSource) {
    return ({ children }: { children: ReactNode }) => (
        <ServicesProvider services={{ help }}>{children}</ServicesProvider>
    );
}

describe("useHelp", () => {
    it("starts loading, then resolves to the items", async () => {
        const { result } = renderHook(() => useHelp("en"), { wrapper: wrapper(fakeHelp([item])) });
        expect(result.current.loading).toBe(true);
        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(result.current.items).toEqual([item]);
    });

    it("resolves to an empty list when the source throws", async () => {
        const failing: HelpSource = { fetchItems: async () => Promise.reject(new Error("x")) };
        const { result } = renderHook(() => useHelp("en"), { wrapper: wrapper(failing) });
        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(result.current.items).toEqual([]);
    });
});
