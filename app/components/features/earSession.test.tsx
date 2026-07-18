// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EAR_SESSION_ROUNDS } from "../../../core/earCatalog";
import type { EarExerciseId } from "../../../core/earExercise";
import { fakeAudioEngine } from "../../adapters/fakeAudioEngine";
import { m } from "../../paraglide/messages.js";
import { renderWithServices } from "../../testing/renderWithServices";
import { EarSession } from "./earSession";

afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
});

// The generators are random, so the rng is pinned to its floor: the first option is
// always taken, which makes the question knowable. At zero an interval round asks for a
// unison and a perfect-pitch round sounds the lowest natural in range (G3).
function mount(
    props: {
        exercise?: EarExerciseId;
        level?: number;
        autoStart?: boolean;
        onComplete?: (id: string) => void;
    } = {},
) {
    vi.spyOn(Math, "random").mockReturnValue(0);
    return renderWithServices(
        <EarSession exercise={props.exercise ?? "intervals"} level={props.level ?? 0} {...props} />,
        { audio: fakeAudioEngine() },
    );
}

const press = (name: string) => fireEvent.click(screen.getByRole("button", { name }));

// Answers a whole session with `answerName`, pressing Next between rounds.
function playSession(answerName: string, autoStarted = false) {
    if (!autoStarted) {
        press(m.ear_start());
    }
    for (let round = 0; round < EAR_SESSION_ROUNDS; round++) {
        press(answerName);
        if (round < EAR_SESSION_ROUNDS - 1) {
            press(m.ear_next());
        }
    }
}

describe("EarSession", () => {
    it("rests on a start card before the first question", () => {
        mount();
        expect(screen.getByRole("button", { name: m.ear_start() })).toBeTruthy();
        expect(screen.queryByRole("group", { name: m.ear_ladder_label() })).toBeNull();
    });

    it("opens straight on the question when told to auto-start", () => {
        const { services } = mount({ autoStart: true });
        expect(screen.queryByRole("button", { name: m.ear_start() })).toBeNull();
        expect(screen.getByRole("group", { name: m.ear_ladder_label() })).toBeTruthy();
        expect((services.audio as ReturnType<typeof fakeAudioEngine>).strikes).toHaveLength(2);
    });

    it("confirms a right answer and offers the next round", () => {
        mount();
        press(m.ear_start());
        press(m.theory_interval_unison());
        expect(screen.getByText(m.ear_verdict_right())).toBeTruthy();
        expect(screen.getByRole("button", { name: m.ear_next() })).toBeTruthy();
    });

    it("names what played instead of scolding a wrong answer", () => {
        mount();
        press(m.ear_start());
        press(m.theory_interval_octave());
        expect(screen.getByText(m.ear_verdict_close())).toBeTruthy();
    });

    it("records a finished session into the ear item's mastery", () => {
        const { services } = mount();
        playSession(m.theory_interval_unison());
        const record = services.mastery.load("ear-intervals-0");
        expect(record?.bestScore).toBe(100);
        expect(record?.learned).toBe(true);
    });

    it("records to the level being trained", () => {
        const { services } = mount({ level: 1 });
        playSession(m.theory_interval_unison());
        expect(services.mastery.load("ear-intervals-1")?.bestScore).toBe(100);
        expect(services.mastery.load("ear-intervals-0")).toBeNull();
    });

    it("records a perfect-pitch session to its own item", () => {
        const { services } = mount({ exercise: "perfect-pitch" });
        playSession("G"); // Math.random pinned to 0 sounds the lowest natural, G3
        expect(services.mastery.load("ear-perfect-pitch")?.bestScore).toBe(100);
    });

    it("records once per session, not once per round", () => {
        const { services } = mount();
        const save = vi.spyOn(services.mastery, "save");
        playSession(m.theory_interval_unison());
        const earSaves = save.mock.calls.filter(([id]) => id === "ear-intervals-0");
        expect(earSaves).toHaveLength(1);
    });

    it("calls onComplete with the item id when a run finishes", () => {
        const onComplete = vi.fn();
        mount({ autoStart: true, onComplete });
        playSession(m.theory_interval_unison(), true);
        expect(onComplete).toHaveBeenCalledWith("ear-intervals-0");
    });

    it("offers another run standalone, with the result recorded", () => {
        mount();
        playSession(m.theory_interval_unison());
        expect(screen.getByText(m.ear_session_recorded())).toBeTruthy();
        expect(screen.getByRole("button", { name: m.ear_again() })).toBeTruthy();
        expect(screen.queryByRole("button", { name: m.ear_next() })).toBeNull();
    });

    it("leaves the next step to the caller when a run is driven for review", () => {
        mount({ autoStart: true, onComplete: vi.fn() });
        playSession(m.theory_interval_unison(), true);
        // The caller owns what comes next, so no practise-again button here.
        expect(screen.queryByRole("button", { name: m.ear_again() })).toBeNull();
        expect(screen.getByText(m.ear_session_recorded())).toBeTruthy();
    });

    it("names the note on a keyboard for perfect pitch, naturals only at first", () => {
        mount({ exercise: "perfect-pitch" });
        press(m.ear_start());
        expect(screen.getByRole("group", { name: m.ear_keyboard_label() })).toBeTruthy();
        expect(screen.queryByRole("button", { name: "C♯" })).toBeNull();
        press("G");
        expect(screen.getByText(m.ear_verdict_right())).toBeTruthy();
    });

    it("names a chord's quality from a choice grid, recorded to the chord item", () => {
        const { services } = mount({ exercise: "chords" });
        // Math.random pinned to 0 asks for the first quality of the level: major.
        press(m.ear_start());
        expect(screen.getByRole("group", { name: m.ear_chord_choices() })).toBeTruthy();
        press(m.theory_chord_major());
        expect(screen.getByText(m.ear_verdict_right())).toBeTruthy();

        for (let round = 1; round < EAR_SESSION_ROUNDS; round++) {
            press(m.ear_next());
            press(m.theory_chord_major());
        }
        expect(services.mastery.load("ear-chords-0")?.bestScore).toBe(100);
    });

    it("names a scale from a choice grid, recorded to the scale item", () => {
        const { services } = mount({ exercise: "scales" });
        // Math.random pinned to 0 asks for the first scale of the level: major.
        press(m.ear_start());
        expect(screen.getByRole("group", { name: m.ear_scale_choices() })).toBeTruthy();
        press(m.theory_scale_major());
        expect(screen.getByText(m.ear_verdict_right())).toBeTruthy();

        for (let round = 1; round < EAR_SESSION_ROUNDS; round++) {
            press(m.ear_next());
            press(m.theory_scale_major());
        }
        expect(services.mastery.load("ear-scales-0")?.bestScore).toBe(100);
    });

    it("names a progression chord by chord, recorded to the progression item", () => {
        const { services } = mount({ exercise: "progressions" });
        // Math.random pinned to 0 builds I–IV–V–I from the primary triads.
        const answer = () => {
            for (const degree of ["I", "IV", "V", "I"]) {
                press(degree);
            }
        };
        press(m.ear_start());
        answer();
        // The round settles only once the whole sequence is entered.
        expect(screen.getByText(m.ear_verdict_right())).toBeTruthy();

        for (let round = 1; round < EAR_SESSION_ROUNDS; round++) {
            press(m.ear_next());
            answer();
        }
        expect(services.mastery.load("ear-progressions-0")?.bestScore).toBe(100);
    });
});
