// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import { act, render } from "@testing-library/react";
import { type ReactNode, useSyncExternalStore } from "react";
import { describe, expect, it } from "vitest";
import { memoryStore } from "../adapters/memoryStore";
import { createServices, ServicesProvider } from "../contexts/services";
import { fakeScheduler } from "../testing/fakeScheduler";
import { useHoldIndicator } from "./useHoldIndicator";

// What the change is actually for.
//
// The fills move every animation frame while a note is held. When they were React state
// in this hook, the component that owned the hook re-rendered at that rate — and the
// owner is the play session, whose value every panel on the surface reads. One held note
// repainted the whole tree sixty times a second.
//
// This pins the shape that fixes it: the hook's owner renders once, and only what
// subscribes follows the frames. A counter is the only honest way to assert it; a
// snapshot cannot see work that did not happen.

describe("the hold fills and who re-renders for them", () => {
    it("leaves the hook's owner alone while a fill drains", () => {
        const scheduler = fakeScheduler();
        const services = createServices({ store: memoryStore(), scheduler });
        let ownerRenders = 0;
        let keyboardRenders = 0;
        let begin: (holds: { note: number; durationMs: number }[]) => void = () => {};

        // Stands in for the play session: owns the hook, and everything else on the
        // surface renders beneath it.
        function Owner({ children }: { children: ReactNode }) {
            const indicator = useHoldIndicator();
            ownerRenders += 1;
            begin = indicator.begin;
            return <Keys feed={indicator.holds}>{children}</Keys>;
        }

        // Stands in for the keyboard: the one component that paints the fills.
        function Keys({
            feed,
        }: {
            feed: ReturnType<typeof useHoldIndicator>["holds"];
            children: ReactNode;
        }) {
            useSyncExternalStore(feed.subscribe, feed.get, feed.get);
            keyboardRenders += 1;
            return null;
        }

        render(
            <ServicesProvider services={services}>
                <Owner>{null}</Owner>
            </ServicesProvider>,
        );
        const ownerAtStart = ownerRenders;
        const keyboardAtStart = keyboardRenders;

        act(() => begin([{ note: 60, durationMs: 1000 }]));
        for (let frame = 0; frame < 30; frame++) {
            act(() => {
                scheduler.advance(16);
                scheduler.runFrames();
            });
        }

        // Thirty frames of a draining fill.
        expect(keyboardRenders).toBeGreaterThan(keyboardAtStart + 20);
        // And not one of them reached the owner.
        expect(ownerRenders).toBe(ownerAtStart);
    });
});
