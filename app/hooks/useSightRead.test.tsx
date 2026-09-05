// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import { act, cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { AidPrefs } from "../../core/readingLevel";
import { sightReadAids } from "../../core/sightRead";
import { createServices, ServicesProvider } from "../contexts/services";
import { memoryStore } from "../adapters/memoryStore";
import { advanceScheduler } from "../testing/advanceScheduler";
import { fakeScheduler } from "../testing/fakeScheduler";
import { type SightRead, useSightRead } from "./useSightRead";

const SAVED: AidPrefs = {
    noteLabels: "all",
    noteHints: "always",
    colorNotes: true,
    forgiving: true,
    highway: true,
    showFingerings: true,
};

function mount() {
    const scheduler = fakeScheduler();
    const services = createServices({ store: memoryStore(), scheduler });
    let api: SightRead | null = null;
    function Probe() {
        api = useSightRead(SAVED);
        return null;
    }
    const element = (
        <ServicesProvider services={services}>
            <Probe />
        </ServicesProvider>
    );
    const view = render(element);
    return {
        scheduler,
        view,
        // Non-null by the time any test reads it — the probe renders synchronously.
        read: () => api as SightRead,
        // The same tree again: a render that changes nothing.
        rerender: () => view.rerender(element),
    };
}

afterEach(cleanup);

describe("useSightRead", () => {
    it("leaves the player's own aids alone until the mode is on", () => {
        const { read } = mount();

        expect(read().aids).toEqual(SAVED);

        act(() => read().setOn(true));
        expect(read().aids).toEqual(sightReadAids());

        act(() => read().setOn(false));
        expect(read().aids).toEqual(SAVED);
    });

    it("starts no countdown when the mode is off", async () => {
        const { read, scheduler } = mount();
        let resolved = false;

        await act(async () => {
            read()
                .study()
                .then(() => {
                    resolved = true;
                });
        });

        expect(resolved).toBe(true);
        expect(read().countdown).toBeNull();
        expect(scheduler.pending().timers).toBe(0);
    });

    it("counts the study time down and then lets the run start", async () => {
        const { read, scheduler } = mount();
        act(() => read().setOn(true));
        act(() => read().setStudySeconds(5));
        let started = false;

        await act(async () => {
            read()
                .study()
                .then(() => {
                    started = true;
                });
        });
        expect(read().countdown).toBe(5);

        await advanceScheduler(scheduler, 2000);
        expect(read().countdown).toBe(3);
        expect(started).toBe(false);

        await advanceScheduler(scheduler, 3000);
        expect(started).toBe(true);
        expect(read().countdown).toBeNull();
        // The ticker stops itself rather than running on under a started run.
        expect(scheduler.pending().timers).toBe(0);
    });

    it("never starts the run a cancelled countdown belonged to", async () => {
        const { read, scheduler } = mount();
        act(() => read().setOn(true));
        let started = false;

        await act(async () => {
            read()
                .study()
                .then(() => {
                    started = true;
                });
        });
        act(() => read().cancel());

        await advanceScheduler(scheduler, 60_000);
        expect(started).toBe(false);
        expect(read().countdown).toBeNull();
        expect(scheduler.pending().timers).toBe(0);
    });

    it("drops a countdown when the mode is switched off mid-study", async () => {
        const { read, scheduler } = mount();
        act(() => read().setOn(true));

        await act(async () => {
            read().study();
        });
        expect(read().countdown).not.toBeNull();

        act(() => read().setOn(false));
        expect(read().countdown).toBeNull();
        expect(scheduler.pending().timers).toBe(0);
    });

    it("leaves no timer running after unmount", async () => {
        const { read, scheduler, view } = mount();
        act(() => read().setOn(true));
        await act(async () => {
            read().study();
        });

        view.unmount();

        expect(scheduler.pending().timers).toBe(0);
    });
});

describe("what a sight-read takes away", () => {
    it("strips the printed fingering along with the rest", () => {
        // "One cold read, nothing to lean on" — and a number printed over the note is
        // something to lean on. Fingering was not in the ladder at all, so a sight-read
        // took the names, colours, hints and highway and left the fingering behind.
        const { read } = mount();
        expect(read().aids.showFingerings).toBe(true);

        act(() => read().setOn(true));
        expect(read().aids).toEqual({
            noteLabels: "off",
            noteHints: "never",
            colorNotes: false,
            forgiving: false,
            highway: false,
            showFingerings: false,
        });

        act(() => read().setOn(false));
        expect(read().aids).toEqual(SAVED);
    });

    it("hands back the same object, and the same aids, across a render that changes nothing", () => {
        const { read, rerender } = mount();
        const before = read();
        rerender();
        expect(read()).toBe(before);
        expect(read().aids).toBe(before.aids);
        act(() => read().setVanish(false));
        expect(read()).not.toBe(before);
    });
});
