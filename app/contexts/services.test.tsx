// @vitest-environment jsdom
// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { memoryStore } from "../adapters/memoryStore";
import { m } from "../paraglide/messages.js";
import type { ExerciseConfig } from "../../core/exerciseGen";
import type { ExerciseMeta } from "../stores/exerciseSource";
import { createServices, ServicesProvider, useStore } from "./services";

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

    // The composition root names a generated scale through the player's stored choice, so
    // a change in Settings reaches the next list of exercises drawn.
    it("titles a generated scale in the note names the player chose", async () => {
        const config: ExerciseConfig = {
            type: "major-scale",
            key: "b",
            octaves: 1,
            hands: "right",
            inversion: 0,
            interval: "single",
        };
        const meta: ExerciseMeta = {
            id: "ex-b",
            title: "B major scale",
            grade: 1,
            cost: 1,
            kind: "scale-arpeggio",
            config,
            tempo: 80,
            beatsPerBar: 4,
        };
        const services = createServices({
            store: memoryStore(),
            fetcher: (url) =>
                Promise.resolve(
                    url.endsWith("manifest.json")
                        ? Response.json([meta])
                        : new Response(null, { status: 404 }),
                ),
        });
        const title = async () => (await services.exercises.manifest())?.[0]?.title;
        expect(await title()).toMatch(/^B /);
        services.prefs.save({ ...services.prefs.load(), noteLetters: "h" });
        expect(await title()).toMatch(/^H /);
        services.prefs.save({ ...services.prefs.load(), noteLabels: "solfege" });
        expect(await title()).toMatch(new RegExp(`^${m.solfege_si()}`, "i"));
    });
});
