// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { DEFAULT_PREFS } from "../../core/prefs";
import { memoryStore } from "../adapters/memoryStore";
import { createPrefsStore } from "../stores/prefsStore";
import { ServicesProvider } from "../contexts/services";
import { useNoteLabels } from "./useNoteLabels";

describe("useNoteLabels", () => {
    it("starts at the default label mode and follows the prefs store when it changes", () => {
        const kv = memoryStore();
        const prefs = createPrefsStore(kv);
        const wrapper = ({ children }: { children: ReactNode }) => (
            <ServicesProvider services={{ store: kv, prefs }}>{children}</ServicesProvider>
        );
        const { result } = renderHook(() => useNoteLabels(), { wrapper });
        expect(result.current).toBe(DEFAULT_PREFS.noteLabels);

        act(() => {
            prefs.save({ ...prefs.load(), noteLabels: "off" });
        });
        expect(result.current).toBe("off");
    });
});
