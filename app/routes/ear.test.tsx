// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EAR_SESSION_ROUNDS } from "../../core/earCatalog";
import { fakeAudioEngine } from "../adapters/fakeAudioEngine";
import { m } from "../paraglide/messages.js";
import { choose } from "../testing/controls";
import { renderWithServices } from "../testing/renderWithServices";
import Ear from "./ear";

afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
});

// The exercises are random by nature, so the rng is pinned to its floor: the generator
// then always takes the first option, which makes the question knowable without the
// test reaching inside it. At zero, an interval round asks for a unison and a
// perfect-pitch round sounds the lowest natural in range (G3).
function renderEar() {
    vi.spyOn(Math, "random").mockReturnValue(0);
    return renderWithServices(<Ear />, { audio: fakeAudioEngine() });
}

const press = (name: string) => fireEvent.click(screen.getByRole("button", { name }));

// Plays a whole session, answering every round with `answerName`. Between rounds the
// player presses "Next one"; the last round has no next — the session is done.
function playSession(answerName: string) {
    press(m.ear_start());
    for (let round = 0; round < EAR_SESSION_ROUNDS; round++) {
        press(answerName);
        if (round < EAR_SESSION_ROUNDS - 1) {
            press(m.ear_next());
        }
    }
}

describe("ear training", () => {
    it("offers the exercise before asking anything", () => {
        renderEar();
        expect(screen.getByRole("button", { name: m.ear_start() })).toBeTruthy();
        expect(screen.queryByRole("group", { name: m.ear_ladder_label() })).toBeNull();
    });

    it("sounds the question as soon as a round starts", () => {
        const { services } = renderEar();
        press(m.ear_start());

        const audio = services.audio as ReturnType<typeof fakeAudioEngine>;
        // Two notes: an interval is heard as a pair, whatever the answer turns out to be.
        expect(audio.strikes).toHaveLength(2);
        expect(screen.getByRole("group", { name: m.ear_ladder_label() })).toBeTruthy();
    });

    it("confirms a right answer and offers the next round", () => {
        renderEar();
        press(m.ear_start());
        press(m.theory_interval_unison());

        expect(screen.getByText(m.ear_verdict_right())).toBeTruthy();
        expect(screen.getByText(m.ear_score({ correct: 1, asked: 1 }))).toBeTruthy();
        expect(screen.getByRole("button", { name: m.ear_next() })).toBeTruthy();
    });

    it("names what played instead of scolding a wrong answer", () => {
        renderEar();
        press(m.ear_start());
        press(m.theory_interval_octave());

        expect(screen.getByText(m.ear_verdict_close())).toBeTruthy();
        expect(screen.getByText(m.ear_score({ correct: 0, asked: 1 }))).toBeTruthy();
    });

    it("locks the choices once a round is answered", () => {
        renderEar();
        press(m.ear_start());
        press(m.theory_interval_octave());
        // A second press must not overwrite the verdict or score the round twice.
        press(m.theory_interval_octave());

        expect(screen.getByText(m.ear_score({ correct: 0, asked: 1 }))).toBeTruthy();
        expect(screen.getByText(m.ear_verdict_close())).toBeTruthy();
    });

    it("starts a fresh session when the exercise changes", () => {
        renderEar();
        press(m.ear_start());
        press(m.theory_interval_unison());

        choose(m.ear_exercise_label, m.ear_exercise_perfect_pitch);
        // The score answered a different question, so it goes rather than carrying over.
        expect(screen.queryByText(m.ear_score({ correct: 1, asked: 1 }))).toBeNull();
        expect(screen.getByRole("button", { name: m.ear_start() })).toBeTruthy();
    });

    it("names the note on a keyboard in the perfect-pitch exercise", () => {
        renderEar();
        choose(m.ear_exercise_label, m.ear_exercise_perfect_pitch);
        press(m.ear_start());

        expect(screen.getByRole("group", { name: m.ear_keyboard_label() })).toBeTruthy();
        press("G");
        expect(screen.getByText(m.ear_verdict_right())).toBeTruthy();
    });

    it("only offers the naturals while the black keys are out", () => {
        renderEar();
        choose(m.ear_exercise_label, m.ear_exercise_perfect_pitch);
        press(m.ear_start());

        expect(screen.queryByRole("button", { name: "C♯" })).toBeNull();
        expect(screen.getByRole("button", { name: "C" })).toBeTruthy();
    });

    it("hides the level choice for an exercise that has no levels", () => {
        renderEar();
        expect(screen.queryByText(m.ear_level_help())).toBeTruthy();
        choose(m.ear_exercise_label, m.ear_exercise_perfect_pitch);
        expect(screen.queryByText(m.ear_level_help())).toBeNull();
    });

    it("records a finished session into the ear item's mastery", () => {
        const { services } = renderEar();
        playSession(m.theory_interval_unison());

        // Every round was a correct unison, so the item is learned at a flawless score.
        const record = services.mastery.load("ear-intervals-0");
        expect(record?.bestScore).toBe(100);
        expect(record?.learned).toBe(true);
    });

    it("records to the level being trained, not another", () => {
        const { services } = renderEar();
        choose(m.ear_level_label, m.ear_level_thirds); // level 1
        playSession(m.theory_interval_unison());

        expect(services.mastery.load("ear-intervals-1")?.bestScore).toBe(100);
        expect(services.mastery.load("ear-intervals-0")).toBeNull();
    });

    it("records a perfect-pitch session to its own item", () => {
        const { services } = renderEar();
        choose(m.ear_exercise_label, m.ear_exercise_perfect_pitch);
        playSession("G"); // Math.random pinned to 0 sounds the lowest natural, G3

        expect(services.mastery.load("ear-perfect-pitch")?.bestScore).toBe(100);
    });

    it("records once per session, not once per round", () => {
        const { services } = renderEar();
        const save = vi.spyOn(services.mastery, "save");
        playSession(m.theory_interval_unison());

        const earSaves = save.mock.calls.filter(([id]) => id === "ear-intervals-0");
        expect(earSaves).toHaveLength(1);
    });

    it("offers another session and stops taking answers once done", () => {
        renderEar();
        playSession(m.theory_interval_unison());

        expect(screen.getByText(m.ear_session_recorded())).toBeTruthy();
        expect(screen.getByRole("button", { name: m.ear_again() })).toBeTruthy();
        expect(screen.queryByRole("button", { name: m.ear_next() })).toBeNull();
    });
});
