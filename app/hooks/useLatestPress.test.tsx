// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useLatestPress } from "./useLatestPress";

describe("useLatestPress", () => {
    const harness = () => {
        const view = renderHook(() => useLatestPress());
        return { press: () => view.result.current.press(), api: () => view.result.current, view };
    };

    it("lets a lone press act", () => {
        const { press } = harness();
        expect(press()()).toBe(true);
    });

    it("lets the same press ask more than once", () => {
        const { press } = harness();
        const mine = press();
        expect(mine()).toBe(true);
        expect(mine()).toBe(true);
    });

    it("overtakes an earlier press", () => {
        // Practice pressed twice: the first press's deferred start must not arrive on
        // top of the run the second one is setting up.
        const { press } = harness();
        const first = press();
        const second = press();
        expect(first()).toBe(false);
        expect(second()).toBe(true);
    });

    it("keeps only the newest of many", () => {
        const { press } = harness();
        const claims = [press(), press(), press(), press()];
        expect(claims.map((held) => held())).toEqual([false, false, false, true]);
    });

    it("cancels an outstanding press without granting a new one", () => {
        // Stopping ends the run; a start already counting down must find itself
        // overtaken by nobody rather than arriving on an empty surface.
        const { press, api } = harness();
        const pending = press();
        api().cancel();
        expect(pending()).toBe(false);
    });

    it("lets a fresh press act after a cancel", () => {
        const { press, api } = harness();
        press();
        api().cancel();
        const next = press();
        expect(next()).toBe(true);
    });

    it("keeps one identity across renders", () => {
        const { api, view } = harness();
        const first = api();
        view.rerender();
        expect(api()).toBe(first);
    });
});
