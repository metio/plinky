// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import { act, cleanup, fireEvent, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Mastery } from "../../../core/mastery";
import { fakeAudioEngine } from "../../adapters/fakeAudioEngine";
import { fakeMidi } from "../../adapters/fakeMidi";
import { MidiProvider, useHeldNotes, useMidiInput } from "../../contexts/midi";
import type { GradedMastery } from "../../lib/gradeProgress";
import { m } from "../../paraglide/messages.js";
import { renderWithServices } from "../../testing/renderWithServices";
import { ReviewSession } from "./reviewSession";

// A score item stands in for the real viewer by doing the one thing that matters here: it
// plays the computer keyboard, as the play session does, and shows what is held.
const { heard } = vi.hoisted(() => ({ heard: [] as number[] }));
vi.mock("./scoreViewer", () => ({
    ScoreViewer: ({ title }: { title: string }) => {
        useMidiInput({ keys: true, onNoteOn: (event) => heard.push(event.note) });
        const held = useHeldNotes();
        return (
            <div>
                viewer:{title} held:{held.length}
            </div>
        );
    },
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
    deadline: "",
};

const item = (id: string, kind: "ear" | "piece"): GradedMastery => ({
    id,
    title: id,
    grade: 1,
    cost: 1,
    kind,
    mastery: due,
});

afterEach(() => {
    cleanup();
    heard.length = 0;
    masteryMock.mockReset();
    vi.restoreAllMocks();
});

const key = (type: "keydown" | "keyup", digit: string) =>
    act(() => {
        window.dispatchEvent(new KeyboardEvent(type, { key: digit, code: `Digit${digit}` }));
    });

function renderReview() {
    // Pinned to the floor, the triad level asks for its first degree, 1.
    vi.spyOn(Math, "random").mockReturnValue(0);
    masteryMock.mockResolvedValue([item("ear-scale-degrees-0", "ear"), item("a", "piece")]);
    return renderWithServices(
        <MemoryRouter>
            <MidiProvider>
                <ReviewSession />
            </MidiProvider>
        </MemoryRouter>,
        { audio: fakeAudioEngine(), midi: fakeMidi() },
    );
}

// The review's own Skip, not the drill's: the drill has one of the same name.
const skipTheItem = () => {
    const skips = screen.getAllByRole("button", { name: m.review_skip() });
    fireEvent.click(skips[skips.length - 1] as HTMLElement);
};

describe("ReviewSession number keys", () => {
    it("answers a due scale-degree drill from the number keys", async () => {
        renderReview();
        await screen.findByRole("group", { name: m.ear_degree_choices() });
        key("keydown", "1");
        expect(screen.getByText(m.ear_verdict_right())).toBeTruthy();
        expect(screen.getByText(m.ear_score({ correct: 1, asked: 1 }))).toBeTruthy();
    });

    it("hands the digits back to the piano when the review moves on to a score", async () => {
        renderReview();
        await screen.findByRole("group", { name: m.ear_degree_choices() });

        // Pressed on the drill, where 5 is an answer and so sounds nothing, and let go
        // only once the score is up: that keyup must not leave a note behind.
        key("keydown", "5");
        skipTheItem();
        await screen.findByText(/viewer:Title a/);
        key("keyup", "5");
        expect(screen.getByText(/held:0/)).toBeTruthy();
        expect(heard).toEqual([]);

        // On the score the same key is a piano key again, and lets go cleanly.
        key("keydown", "5");
        expect(heard).toHaveLength(1);
        expect(screen.getByText(/held:1/)).toBeTruthy();
        key("keyup", "5");
        expect(screen.getByText(/held:0/)).toBeTruthy();
    });
});
