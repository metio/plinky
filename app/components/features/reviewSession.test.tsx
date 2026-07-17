// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { cleanup, fireEvent, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EAR_SESSION_ROUNDS } from "../../../core/earCatalog";
import type { Mastery } from "../../../core/mastery";
import { fakeAudioEngine } from "../../adapters/fakeAudioEngine";
import type { GradedMastery } from "../../lib/gradeProgress";

import { m } from "../../paraglide/messages.js";
import { renderWithServices } from "../../testing/renderWithServices";
import { ReviewSession } from "./reviewSession";

// Stub the heavy score viewer (OSMD) and the score resolver, so the test exercises the
// session flow, not playback.
vi.mock("./scoreViewer", () => ({
    ScoreViewer: ({ title, onRunComplete }: { title: string; onRunComplete?: () => void }) => (
        <div>
            viewer:{title}
            <button type="button" onClick={() => onRunComplete?.()}>
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
    return ids.map((id) => ({ id, title: id, grade: 1, cost: 1, kind: "piece", mastery: due }));
}

const earItem = (id: string, title: string): GradedMastery => ({
    id,
    title,
    grade: 1,
    cost: 1,
    kind: "ear",
    mastery: due,
});

afterEach(() => {
    cleanup();
    masteryMock.mockReset();
    vi.restoreAllMocks();
});

function renderSession() {
    return renderWithServices(
        <MemoryRouter>
            <ReviewSession />
        </MemoryRouter>,
        { audio: fakeAudioEngine() },
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

    it("drives an ear drill for a due ear item, not a score", async () => {
        vi.spyOn(Math, "random").mockReturnValue(0);
        masteryMock.mockResolvedValue([earItem("ear-intervals-0", "Intervals · Fifths")]);
        renderSession();

        // The ear drill's answer surface, titled by the item — not the score viewer.
        expect(await screen.findByRole("group", { name: m.ear_ladder_label() })).toBeTruthy();
        expect(screen.getByText("Intervals · Fifths")).toBeTruthy();
        expect(screen.queryByText(/^viewer:/)).toBeNull();
    });

    it("counts an ear item refreshed once its drill is finished", async () => {
        vi.spyOn(Math, "random").mockReturnValue(0);
        masteryMock.mockResolvedValue([earItem("ear-intervals-0", "Intervals · Fifths")]);
        renderSession();

        await screen.findByRole("group", { name: m.ear_ladder_label() });
        // A drill auto-starts, so the whole session is answered in place; only when it
        // finishes does the advance become Next rather than Skip.
        for (let round = 0; round < EAR_SESSION_ROUNDS; round++) {
            fireEvent.click(screen.getByRole("button", { name: m.theory_interval_unison() }));
            if (round < EAR_SESSION_ROUNDS - 1) {
                fireEvent.click(screen.getByRole("button", { name: m.ear_next() }));
            }
        }
        fireEvent.click(await screen.findByText("Next →"));
        expect(await screen.findByText(/review complete/i)).toBeTruthy();
    });

    it("says so when nothing is due", async () => {
        masteryMock.mockResolvedValue([]);
        renderSession();
        expect(await screen.findByText(m.review_empty())).toBeTruthy();
    });

    it("explains what review is for and offers somewhere to go, rather than dead-ending", async () => {
        masteryMock.mockResolvedValue([]);
        renderSession();
        // Arriving with nothing due is how a new player meets this feature, so the
        // page has to teach it rather than just report an absence.
        expect(await screen.findByText(m.refresh_why())).toBeTruthy();
        expect(screen.getByRole("link", { name: m.today_browse() }).getAttribute("href")).toContain(
            "/library",
        );
        expect(screen.getByRole("link", { name: m.review_back() })).toBeTruthy();
    });
});
