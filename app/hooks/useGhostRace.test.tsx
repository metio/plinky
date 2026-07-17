// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import { encodeGhost } from "../../core/ghost";
import { memoryStore } from "../adapters/memoryStore";
import { type AppServices, createServices, ServicesProvider } from "../contexts/services";
import { createActivitySignal } from "../lib/activity";
import { fakeScheduler } from "../testing/fakeScheduler";
import { useGhostRace } from "./useGhostRace";

const SONG = "gymnopedie";

// The race advances on the injected clock, so the scheduler's virtual time is both
// what the 50ms tick runs on and what the run's elapsed time is measured against —
// winding it forward is the whole run.
function harness(options: { search?: string; services?: Partial<AppServices> } = {}) {
    // A monotonic clock is never at zero mid-session, and the hook reads a zero
    // start as "the run's first note has not landed" — so the fake starts off zero,
    // as the real one is.
    const scheduler = fakeScheduler(10_000);
    const services = createServices({
        store: memoryStore(),
        activity: createActivitySignal(),
        scheduler,
        ...options.services,
    });
    // The run's zero: the ghost stays at the line until the player's first note lands.
    let startedAt = 0;
    const wrapper = ({ children }: { children: ReactNode }) => (
        <MemoryRouter initialEntries={[`/play/${SONG}${options.search ?? ""}`]}>
            <ServicesProvider services={services}>{children}</ServicesProvider>
        </MemoryRouter>
    );
    const render = (props: { practicing: boolean; complete?: boolean; done?: number }) =>
        useGhostRace({
            id: SONG,
            canShareGhost: true,
            getOsmd: () => null,
            practicing: props.practicing,
            complete: props.complete ?? false,
            done: props.done ?? 0,
            runStartedAt: () => startedAt,
        });
    return {
        scheduler,
        services,
        start: (at: number) => {
            startedAt = at;
        },
        ...renderHook(render, {
            wrapper,
            initialProps: { practicing: false, complete: false, done: 0 },
        }),
    };
}

describe("useGhostRace", () => {
    it("advances the ghost along its onsets as the run clock elapses", () => {
        const { result, rerender, scheduler, services, start } = harness();
        services.ghosts.save(SONG, [0, 1000, 2000, 3000]);

        act(() => {
            rerender({ practicing: true, complete: false, done: 0 });
        });
        act(() => {
            result.current.arm({ partial: false, raceGhost: true, hand: "both" });
        });
        expect(result.current.ghost).toEqual([0, 1000, 2000, 3000]);
        expect(result.current.ghostDone).toBe(0);

        // The starting gun: the player's first note lands, and the ghost leaves the
        // line from the same moment.
        start(scheduler.now());
        act(() => scheduler.advance(1500));
        expect(result.current.ghostDone).toBe(2);

        act(() => scheduler.advance(1500));
        expect(result.current.ghostDone).toBe(4);
    });

    it("holds the ghost at the line until the run's first note lands", () => {
        const { result, rerender, scheduler, services } = harness();
        services.ghosts.save(SONG, [0, 1000]);

        act(() => {
            rerender({ practicing: true, complete: false, done: 0 });
        });
        act(() => {
            result.current.arm({ partial: false, raceGhost: true, hand: "both" });
        });
        // runStartedAt stays 0 — no note yet — so the clock running on must not
        // advance a race that has not begun.
        act(() => scheduler.advance(5000));
        expect(result.current.ghostDone).toBe(0);
    });

    it("stops the tick when the run stops, leaving no timer behind", () => {
        const { result, rerender, scheduler, services, unmount } = harness();
        services.ghosts.save(SONG, [0, 1000]);

        act(() => {
            rerender({ practicing: true, complete: false, done: 0 });
        });
        act(() => {
            result.current.arm({ partial: false, raceGhost: true, hand: "both" });
        });
        expect(scheduler.pending().timers).toBe(1);

        act(() => {
            rerender({ practicing: false, complete: false, done: 0 });
        });
        expect(scheduler.pending().timers).toBe(0);

        act(() => {
            rerender({ practicing: true, complete: false, done: 0 });
        });
        unmount();
        expect(scheduler.pending().timers).toBe(0);
    });

    it("adopts a ghost handed over by a share link and re-shares it", () => {
        const shared = [0, 250, 500];
        const { result, services } = harness({ search: `?ghost=${encodeGhost(shared)}` });

        expect(result.current.storedGhost).toEqual(shared);
        expect(result.current.sharedFromLink).toBe(true);
        // A friend's ghost is kept for the score, so a reload races it without the link.
        expect(services.ghosts.load(SONG)).toEqual(shared);
    });

    it("falls back to the score's own stored ghost when no link carries one", () => {
        const own = [0, 400];
        const { result } = harness({
            services: { store: seeded(own) },
        });
        expect(result.current.storedGhost).toEqual(own);
        expect(result.current.sharedFromLink).toBe(false);
    });

    it("keeps no ghost for a score that cannot share one", () => {
        const scheduler = fakeScheduler();
        const services = createServices({
            store: memoryStore(),
            activity: createActivitySignal(),
            scheduler,
        });
        services.ghosts.save(SONG, [0, 100]);
        const { result } = renderHook(
            () =>
                useGhostRace({
                    id: SONG,
                    canShareGhost: false,
                    getOsmd: () => null,
                    practicing: false,
                    complete: false,
                    done: 0,
                    runStartedAt: () => 0,
                }),
            {
                wrapper: ({ children }: { children: ReactNode }) => (
                    <MemoryRouter>
                        <ServicesProvider services={services}>{children}</ServicesProvider>
                    </MemoryRouter>
                ),
            },
        );
        expect(result.current.storedGhost).toBeNull();
    });

    it("races nothing for a partial run, an ephemeral piece, or a declined race", () => {
        const { result, rerender, services } = harness();
        services.ghosts.save(SONG, [0, 1000]);
        act(() => {
            rerender({ practicing: true, complete: false, done: 0 });
        });

        for (const options of [
            { partial: true, raceGhost: true },
            { partial: false, ephemeral: true, raceGhost: true },
            { partial: false, raceGhost: false },
        ]) {
            act(() => {
                result.current.arm({ ...options, hand: "both" });
            });
            expect(result.current.ghost).toBeNull();
        }
    });

    it("mirrors a finished run's own ghost for the share button", () => {
        const { result } = harness();
        act(() => {
            result.current.adoptOwnRun([0, 700]);
        });
        expect(result.current.storedGhost).toEqual([0, 700]);
        expect(result.current.sharedFromLink).toBe(false);
    });
});

// A store already holding a ghost for the score — the hook reads it on mount, so it
// must be in place before the first render rather than saved after it.
function seeded(onsets: number[]) {
    const store = memoryStore();
    createServices({ store, activity: createActivitySignal() }).ghosts.save(SONG, onsets);
    return store;
}
