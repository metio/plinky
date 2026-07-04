// @vitest-environment jsdom
// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { memoryStore } from "../adapters/memoryStore";
import { ServicesProvider, useStore } from "./services";

// A "performing" component: it uses a capability (persistence) but has no idea where
// it came from — no import of an adapter, no global. That is exactly what makes it
// trivial to test.
function Probe() {
    const store = useStore();
    store.set("plinky:probe", "hi");
    return <output>{store.get("plinky:probe")}</output>;
}

describe("ServicesProvider", () => {
    afterEach(cleanup);

    it("hands a component the injected store, so a test needs no jsdom globals stubbed", () => {
        const fake = memoryStore();
        const { getByRole } = render(
            <ServicesProvider services={{ store: fake }}>
                <Probe />
            </ServicesProvider>,
        );
        expect(getByRole("status").textContent).toBe("hi");
        // The write went to the fake we handed in — nothing else to inspect.
        expect(fake.get("plinky:probe")).toBe("hi");
    });

    it("supplies working services even with no provider above it", () => {
        const { getByRole } = render(<Probe />);
        expect(getByRole("status").textContent).toBe("hi");
    });

    it("keeps one service set across re-renders even for an inline services literal", () => {
        const fake = memoryStore();
        const seen: unknown[] = [];
        function Collector() {
            seen.push(useStore());
            return null;
        }
        const { rerender } = render(
            <ServicesProvider services={{ store: fake }}>
                <Collector />
            </ServicesProvider>,
        );
        // A fresh prop object with the same override must not rebuild the set —
        // a rebuilt set would orphan every subscriber of the previous instance.
        rerender(
            <ServicesProvider services={{ store: fake }}>
                <Collector />
            </ServicesProvider>,
        );
        expect(seen).toHaveLength(2);
        expect(seen[1]).toBe(seen[0]);
    });
});
