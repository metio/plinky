// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Composition } from "../../../core/composition";
import type { Take } from "../../lib/savedTakes";
import { formatAgo, TakesList } from "./takesList";

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
    activeReplayId: null,
    playing: false,
    onReplay: () => {},
    onStop: () => {},
    onDelete: () => {},
};

// The list lives inside a folded Disclosure, so each test opens it first.
const open = () => fireEvent.click(screen.getByRole("button", { name: /your takes/i }));

describe("TakesList", () => {
    it("lists each saved take with a replay control", () => {
        render(<TakesList {...base} takes={[mk("1"), mk("2", { letter: "A" })]} />);
        open();
        expect(screen.getAllByRole("button", { name: /replay/i })).toHaveLength(2);
    });

    it("shows a graded take's accuracy, timing and flow", () => {
        render(
            <TakesList
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
        open();
        expect(screen.getByText(/Accuracy 91%/)).toBeTruthy();
        expect(screen.getByText(/Timing 73%/)).toBeTruthy();
        expect(screen.getByText(/Flow 88%/)).toBeTruthy();
    });

    it("omits the metrics line for a take with no stored grade", () => {
        render(<TakesList {...base} takes={[mk("1", { metrics: null })]} />);
        open();
        expect(screen.queryByText(/Accuracy/)).toBeNull();
    });

    it("copies a share link when challenging a friend with a take", async () => {
        render(<TakesList {...base} takes={[mk("1")]} />);
        open();
        fireEvent.click(screen.getByRole("button", { name: /challenge a friend/i }));
        expect(await screen.findByText(/link copied/i)).toBeTruthy();
    });

    it("replays the clicked take", () => {
        const onReplay = vi.fn();
        render(<TakesList {...base} takes={[mk("1")]} onReplay={onReplay} />);
        open();
        fireEvent.click(screen.getByRole("button", { name: /replay/i }));
        expect(onReplay).toHaveBeenCalledWith(expect.objectContaining({ id: "1" }));
    });

    it("shows a Stop control for the replaying take and disables the others", () => {
        const onStop = vi.fn();
        render(
            <TakesList
                {...base}
                takes={[mk("1"), mk("2")]}
                activeReplayId="1"
                playing
                onStop={onStop}
            />,
        );
        open();
        fireEvent.click(screen.getByRole("button", { name: /stop/i }));
        expect(onStop).toHaveBeenCalled();
        // The other take can't start a competing replay while one is playing.
        const replay = screen.getByRole("button", { name: /replay/i }) as HTMLButtonElement;
        expect(replay.disabled).toBe(true);
    });

    it("deletes a take by id", () => {
        const onDelete = vi.fn();
        render(<TakesList {...base} takes={[mk("1")]} onDelete={onDelete} />);
        open();
        fireEvent.click(screen.getByRole("button", { name: /delete take/i }));
        expect(onDelete).toHaveBeenCalledWith("1");
    });

    it("flags an incomplete take as partial", () => {
        render(<TakesList {...base} takes={[mk("1", { complete: false })]} />);
        open();
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
