// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { afterEach, describe, expect, it, vi } from "vitest";
import type { Grade } from "../../core/grade";
import type { GradedMastery } from "./gradeProgress";
import type { CapturedNote } from "../../core/runCapture";
import type { Grid } from "../../core/shareCard";
import { memoryStore } from "../adapters/memoryStore";
import { createServices } from "../contexts/services";
import { recordRun } from "./recordRun";

// The grade-up check reads the whole catalogue; stub the join so recordRun's synchronous
// writes and the first-S / flawless branches are tested without building it.
const { loadMock } = vi.hoisted(() => ({
    loadMock: vi.fn<() => Promise<GradedMastery[]>>(),
}));
vi.mock("./gradeProgress", async (importOriginal) => ({
    ...(await importOriginal<typeof import("./gradeProgress")>()),
    loadGradedMastery: loadMock,
}));

afterEach(() => {
    loadMock.mockReset();
    vi.restoreAllMocks();
});

const grade = (over: Partial<Grade> = {}): Grade => ({
    accuracy: 90,
    timing: 88,
    flow: 80,
    dynamics: null,
    expression: null,
    score: 86,
    letter: "A",
    ...over,
});

const notes: CapturedNote[] = [
    { targetMs: 0, playedMs: 10, wrongBefore: 0, staves: [0], velocity: 80, pitches: [60] },
    { targetMs: 500, playedMs: 515, wrongBefore: 0, staves: [0], velocity: 90, pitches: [62] },
];

const run = (over: Partial<Parameters<typeof recordRun>[0]> = {}) => ({
    id: "song-1",
    title: "Minuet",
    partial: false,
    sections: [80, 70, 60, 50, 40, 30],
    notes,
    correct: 2,
    grade: grade(),
    grid: [] as Grid,
    tolerance: 1,
    ...over,
});

describe("recordRun", () => {
    it("folds a full run into every store and returns its onsets as the new ghost", () => {
        const services = createServices({ store: memoryStore() });
        loadMock.mockResolvedValue([]);
        const lifetime = vi.spyOn(services.lifetime, "recordRun");
        const history = vi.spyOn(services.history, "record");

        const { ghost } = recordRun(run(), services, 1000, vi.fn());

        expect(lifetime).toHaveBeenCalledWith({ accuracy: 90, timing: 88, flow: 80 });
        expect(history).toHaveBeenCalledWith(2);
        expect(ghost).toEqual([10, 515]);
        expect(services.ghosts.load("song-1")).toEqual([10, 515]);
        expect(services.mastery.load("song-1")?.bestScore).toBe(86);
    });

    it("records the daily challenge as done with its result", () => {
        const services = createServices({ store: memoryStore() });
        loadMock.mockResolvedValue([]);
        const done = vi.spyOn(services.daily, "recordDone");
        const saved = vi.spyOn(services.daily, "saveResult");

        recordRun(run({ daily: 7 }), services, 1000, vi.fn());

        expect(done).toHaveBeenCalledWith(7);
        expect(saved).toHaveBeenCalledWith(7, expect.objectContaining({ tolerance: 1 }));
    });

    it("leaves an ephemeral piece untracked for ghost and mastery", () => {
        const services = createServices({ store: memoryStore() });
        loadMock.mockResolvedValue([]);
        const history = vi.spyOn(services.history, "record");

        const { ghost } = recordRun(run({ ephemeral: true }), services, 1000, vi.fn());

        expect(history).toHaveBeenCalledWith(2);
        expect(ghost).toBeNull();
        expect(services.ghosts.load("song-1")).toBeNull();
        expect(services.mastery.load("song-1")).toBeNull();
    });

    it("keeps an assessment's reading times out of the per-note record", () => {
        const services = createServices({ store: memoryStore() });
        loadMock.mockResolvedValue([]);
        const history = vi.spyOn(services.history, "record");

        recordRun(run({ ephemeral: true, assessment: true }), services, 1000, vi.fn());

        // The run still counts as practice — only the per-note reading times are
        // withheld, because an assessment picks material above the player's level.
        expect(history).toHaveBeenCalledWith(2);
        expect(services.noteStats.load()).toEqual({});
    });

    it("still folds an ephemeral drill's reading times into the per-note record", () => {
        const services = createServices({ store: memoryStore() });
        loadMock.mockResolvedValue([]);

        recordRun(run({ ephemeral: true }), services, 1000, vi.fn());

        // Gating the per-note record on `ephemeral` would silently take generated
        // practice drills with it; the two flags mean different things.
        expect(Object.keys(services.noteStats.load()).sort()).toEqual(["60", "62"]);
    });

    it("keeps no ghost for a partial run but still folds it into mastery", () => {
        const services = createServices({ store: memoryStore() });
        loadMock.mockResolvedValue([]);

        const { ghost } = recordRun(run({ partial: true }), services, 1000, vi.fn());

        expect(ghost).toBeNull();
        expect(services.ghosts.load("song-1")).toBeNull();
        expect(services.mastery.load("song-1")?.bestScore).toBe(86);
    });

    it("publishes a first-S milestone when a fresh score reaches S", async () => {
        const services = createServices({ store: memoryStore() });
        loadMock.mockResolvedValue([]);
        const publish = vi.fn();

        // An S score (>= 95) that is not flawless (not 100/100/100), on a score with no
        // prior best, so the first-S branch fires and grade-up (empty ladder) does not.
        recordRun(run({ grade: grade({ score: 96, accuracy: 98 }) }), services, 1000, publish);

        await vi.waitFor(() =>
            expect(publish).toHaveBeenCalledWith({
                kind: "first-s",
                songTitle: "Minuet",
            }),
        );
    });

    describe("the verdict", () => {
        // A device with full or blocked storage still grades the run, still sounds the
        // flourish and still paints the panel. Without a verdict the player is shown a
        // grade and a mastered piece that exist only until they reload.
        const refusing = () => ({ ...memoryStore(), set: () => false });

        it("reports saved when every write lands", () => {
            const services = createServices({ store: memoryStore() });
            loadMock.mockResolvedValue([]);

            expect(recordRun(run(), services, 1000, vi.fn()).saved).toBe(true);
        });

        it("reports not saved when the device refuses writes", () => {
            const services = createServices({ store: refusing() });
            loadMock.mockResolvedValue([]);

            expect(recordRun(run(), services, 1000, vi.fn()).saved).toBe(false);
        });

        it("reports not saved when only one of the writes is refused", () => {
            // Folded together on purpose: the player does not care which of the nine
            // refused, only that their run was not fully remembered.
            const store = memoryStore();
            const services = createServices({
                store: {
                    ...store,
                    set: (key, value) =>
                        key.startsWith("plinky:mastery:") ? false : store.set(key, value),
                },
            });
            loadMock.mockResolvedValue([]);

            expect(recordRun(run(), services, 1000, vi.fn()).saved).toBe(false);
        });

        it("still writes everything it can when a write is refused", () => {
            // A refusal is not a reason to abandon the rest: the writes that can land
            // are the player's progress.
            const store = memoryStore();
            const services = createServices({
                store: {
                    ...store,
                    set: (key, value) =>
                        key === "plinky:lifetime" ? false : store.set(key, value),
                },
            });
            loadMock.mockResolvedValue([]);

            const { saved } = recordRun(run(), services, 1000, vi.fn());

            expect(saved).toBe(false);
            expect(services.mastery.load("song-1")?.bestScore).toBe(86);
            expect(services.ghosts.load("song-1")).toEqual([10, 515]);
        });

        it("reports the verdict for an ephemeral run, which returns early", () => {
            const services = createServices({ store: refusing() });
            loadMock.mockResolvedValue([]);

            const { ghost, saved } = recordRun(run({ ephemeral: true }), services, 1000, vi.fn());

            expect(ghost).toBeNull();
            expect(saved).toBe(false);
        });
    });
});
