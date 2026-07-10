// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Composition } from "../../../core/composition";
import type { Take } from "../../../core/takes";
import { formatAgo, TakesPanel } from "./takesPanel";

afterEach(cleanup);

const composition: Composition = {
    notes: [{ pitch: 60, startMs: 0, durationMs: 200, velocity: 90 }],
    tempo: 120,
    beatsPerBar: 4,
};

const mk = (id: string, overrides: Partial<Take> = {}): Take => ({
    id,
    createdAt: 0,
    letter: "B",
    complete: true,
    metrics: null,
    composition,
    ...overrides,
});

const base = {
    id: "song",
    title: "Song",
    credit: "Song · Composer · CC0",
    activeReplayId: null,
    playing: false,
    lastRunOnsets: null,
    canShareLastRun: false,
    onReplay: () => {},
    onStop: () => {},
    onDelete: () => {},
};

describe("TakesPanel", () => {
    it("explains how to make a run when there are none yet", () => {
        render(<TakesPanel {...base} takes={[]} />);
        // As the Runs drawer's body it's shown whenever the drawer is open, so with nothing
        // saved it tells you how to get a run rather than being an empty mystery.
        expect(screen.getByText(/play a piece through/i)).toBeTruthy();
        expect(screen.queryByRole("button", { name: /replay/i })).toBeNull();
    });

    it("offers to share your last run once you've played, even with no take saved", () => {
        render(<TakesPanel {...base} takes={[]} lastRunOnsets={[0, 250, 500]} canShareLastRun />);
        expect(
            screen.getByRole("button", { name: /challenge a friend with your last run/i }),
        ).toBeTruthy();
    });

    it("hides the last-run share when the ghost came from a friend's link", () => {
        render(
            <TakesPanel
                {...base}
                takes={[]}
                lastRunOnsets={[0, 250, 500]}
                canShareLastRun={false}
            />,
        );
        expect(
            screen.queryByRole("button", { name: /challenge a friend with your last run/i }),
        ).toBeNull();
    });

    it("lists each saved take with a replay control", () => {
        render(<TakesPanel {...base} takes={[mk("1"), mk("2", { letter: "A" })]} />);
        expect(screen.getAllByRole("button", { name: /replay/i })).toHaveLength(2);
    });

    it("shows a graded take's accuracy, timing and flow", () => {
        render(
            <TakesPanel
                {...base}
                takes={[
                    mk("1", {
                        metrics: {
                            accuracy: 91,
                            timing: 73,
                            flow: 88,
                            dynamics: null,
                            score: 84,
                            letter: "B",
                        },
                    }),
                ]}
            />,
        );
        expect(screen.getByText(/Accuracy 91%/)).toBeTruthy();
        expect(screen.getByText(/Timing 73%/)).toBeTruthy();
        expect(screen.getByText(/Flow 88%/)).toBeTruthy();
    });

    it("omits the metrics line for a take with no stored grade", () => {
        render(<TakesPanel {...base} takes={[mk("1", { metrics: null })]} />);
        expect(screen.queryByText(/Accuracy/)).toBeNull();
    });

    it("copies a share link when challenging a friend with a take", async () => {
        render(<TakesPanel {...base} takes={[mk("1")]} />);
        fireEvent.click(screen.getByRole("button", { name: /challenge a friend/i }));
        expect(await screen.findByText(/link copied/i)).toBeTruthy();
    });

    it("replays the clicked take", () => {
        const onReplay = vi.fn();
        render(<TakesPanel {...base} takes={[mk("1")]} onReplay={onReplay} />);
        fireEvent.click(screen.getByRole("button", { name: /replay/i }));
        expect(onReplay).toHaveBeenCalledWith(expect.objectContaining({ id: "1" }));
    });

    it("shows a Stop control for the replaying take and disables the others", () => {
        const onStop = vi.fn();
        render(
            <TakesPanel
                {...base}
                takes={[mk("1"), mk("2")]}
                activeReplayId="1"
                playing
                onStop={onStop}
            />,
        );
        fireEvent.click(screen.getByRole("button", { name: /stop/i }));
        expect(onStop).toHaveBeenCalled();
        // The other take can't start a competing replay while one is playing.
        const replay = screen.getByRole("button", { name: /replay/i }) as HTMLButtonElement;
        expect(replay.disabled).toBe(true);
    });

    it("deletes a take by id", () => {
        const onDelete = vi.fn();
        render(<TakesPanel {...base} takes={[mk("1")]} onDelete={onDelete} />);
        fireEvent.click(screen.getByRole("button", { name: /delete run/i }));
        expect(onDelete).toHaveBeenCalledWith("1");
    });

    it("flags an incomplete take as partial", () => {
        render(<TakesPanel {...base} takes={[mk("1", { complete: false })]} />);
        expect(screen.getByText(/partial/i)).toBeTruthy();
    });
});

describe("formatAgo", () => {
    it("reads a just-saved take as moments ago and an older one in minutes", () => {
        const now = 1_000_000;
        expect(formatAgo(now, now, "en")).toMatch(/now|second/i);
        expect(formatAgo(now - 120_000, now, "en")).toMatch(/minute/i);
    });
});
