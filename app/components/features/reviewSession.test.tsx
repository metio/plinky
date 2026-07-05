// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { cleanup, fireEvent, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { GradedMastery } from "../../lib/gradeProgress";
import type { Mastery } from "../../../core/mastery";

import { renderWithServices } from "../../testing/renderWithServices";
import { ReviewSession } from "./reviewSession";

// Stub the heavy score viewer (OSMD) and the score resolver, so the test exercises the
// session flow, not playback.
vi.mock("./scoreViewer", () => ({
    ScoreViewer: ({ title, onMastery }: { title: string; onMastery?: () => void }) => (
        <div>
            viewer:{title}
            <button type="button" onClick={() => onMastery?.()}>
                play {title}
            </button>
        </div>
    ),
}));
vi.mock("../../hooks/useScore", () => ({
    useScore: (id: string) =>
        id ? { id, title: `Title ${id}`, xml: "<x/>", tempo: 90, beatsPerBar: 4 } : undefined,
}));

const { masteryMock } = vi.hoisted(() => ({
    masteryMock: vi.fn<() => Promise<GradedMastery[]>>(),
}));
vi.mock("../../lib/gradeProgress", async (importOriginal) => ({
    ...(await importOriginal<typeof import("../../lib/gradeProgress")>()),
    loadGradedMastery: masteryMock,
}));

const due: Mastery = {
    bestScore: 80,
    learned: true,
    backlog: false,
    intervalDays: 5,
    reviewAt: Date.now() - 1000,
    updatedAt: 0,
};

function queueOf(...ids: string[]): GradedMastery[] {
    return ids.map((id) => ({ id, title: id, grade: 1, cost: 1, mastery: due }));
}

afterEach(() => {
    cleanup();
    masteryMock.mockReset();
});

function renderSession() {
    return renderWithServices(
        <MemoryRouter>
            <ReviewSession />
        </MemoryRouter>,
    );
}

describe("ReviewSession", () => {
    it("walks through every due piece and finishes (skipping unplayed ones)", async () => {
        masteryMock.mockResolvedValue(queueOf("a", "b"));
        renderSession();

        expect(await screen.findByText("Piece 1 of 2")).toBeTruthy();
        // Nothing played yet, so moving on is a Skip, not a refresh.
        fireEvent.click(screen.getByText("Skip"));
        expect(await screen.findByText("Piece 2 of 2")).toBeTruthy();
        fireEvent.click(screen.getByText("Skip"));
        expect(await screen.findByText(/review complete/i)).toBeTruthy();
    });

    it("only counts a piece as refreshed once it has been played", async () => {
        masteryMock.mockResolvedValue(queueOf("a"));
        renderSession();

        await screen.findByText("Piece 1 of 1");
        // Before playing, the advance is a Skip; playing the piece flips it to Next.
        expect(screen.getByText("Skip")).toBeTruthy();
        fireEvent.click(screen.getByText("play Title a"));
        fireEvent.click(await screen.findByText("Next →"));
        expect(await screen.findByText(/review complete/i)).toBeTruthy();
    });

    it("shelves the current piece out of the review", async () => {
        masteryMock.mockResolvedValue(queueOf("a", "b"));
        const { services } = renderSession();
        services.mastery.save("a", due);

        await screen.findByText("Piece 1 of 2");
        fireEvent.click(screen.getByText("Shelve"));

        expect(services.mastery.load("a")?.backlog).toBe(true);
        expect(await screen.findByText("Piece 2 of 2")).toBeTruthy();
    });

    it("says so when nothing is due", async () => {
        masteryMock.mockResolvedValue([]);
        renderSession();
        expect(await screen.findByText(/nothing to review/i)).toBeTruthy();
    });
});
