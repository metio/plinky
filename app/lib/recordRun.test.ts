// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { afterEach, describe, expect, it, vi } from "vitest";
import type { Grade } from "../../core/grade";
import type { GradedMastery } from "./gradeProgress";
import type { OutcomeNote } from "../../core/runOutcome";
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
    score: 86,
    letter: "A",
    ...over,
});

const notes: OutcomeNote[] = [
    { targetMs: 0, playedMs: 10, wrongBefore: 0, staves: [0], velocity: 80 },
    { targetMs: 500, playedMs: 515, wrongBefore: 0, staves: [0], velocity: 90 },
];

const run = (over: Partial<Parameters<typeof recordRun>[0]> = {}) => ({
    id: "song-1",
    title: "Minuet",
    partial: false,
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
});
