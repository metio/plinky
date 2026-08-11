// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import { cleanup, fireEvent, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MIDDLE_C } from "../../../core/keyboardTour";
import { fakeAudioEngine } from "../../adapters/fakeAudioEngine";
import { fakeMidi } from "../../adapters/fakeMidi";
import { memoryStore } from "../../adapters/memoryStore";
import { MidiProvider } from "../../contexts/midi";
import { m } from "../../paraglide/messages.js";
import { renderWithServices } from "../../testing/renderWithServices";
import { KeyboardTour } from "./keyboardTour";

// The staff only draws in a real browser; what is under test here is the teaching —
// which step is open, what satisfies it, and that a wrong key costs nothing.
vi.mock("./notationExample", () => ({
    NotationExample: ({ label }: { label: string }) => <div data-staff={label} />,
}));

afterEach(cleanup);

function mount() {
    const finished = vi.fn();
    const view = renderWithServices(
        <MemoryRouter>
            <MidiProvider>
                <KeyboardTour onFinished={finished} />
            </MidiProvider>
        </MemoryRouter>,
        { store: memoryStore(), audio: fakeAudioEngine(), midi: fakeMidi() },
    );
    return { finished, ...view };
}

// Each on-screen key carries its MIDI number, so a step can be answered exactly rather
// than by guessing at a label that changes with the reader's naming preference.
const press = (note: number) => {
    const key = document.querySelector(`[data-note="${note}"]`);
    if (!key) {
        throw new Error(`no key for note ${note}`);
    }
    fireEvent.pointerDown(key);
    fireEvent.pointerUp(key);
};

const next = () => fireEvent.click(screen.getByRole("button", { name: m.tour_next() }));
const nextDisabled = () =>
    screen.getByRole("button", { name: m.tour_next() }).hasAttribute("disabled");

describe("KeyboardTour", () => {
    it("opens on the black-key groups, with no staff in sight", () => {
        mount();

        expect(screen.getByRole("heading", { level: 2 }).textContent).toBe(
            m.tour_black_groups_title(),
        );
        // The first four steps must not assume the reader can read music.
        expect(document.querySelector("[data-staff]")).toBeNull();
    });

    it("holds the next button until the step has been played", () => {
        mount();

        expect(nextDisabled()).toBe(true);
        expect(screen.getByText(m.tour_waiting())).toBeTruthy();
    });

    it("counts a press that answers the step, and says so", () => {
        mount();

        press(61);

        expect(screen.getByText(m.tour_got_it())).toBeTruthy();
        expect(nextDisabled()).toBe(false);
    });

    it("lets a wrong key sound without costing progress", () => {
        // Wandering along the keys is how a keyboard gets learned; a tour that scolded
        // for it would teach the wrong thing about this app. A white key does not answer
        // the black-key step, and nothing is lost by trying one.
        mount();

        press(MIDDLE_C);

        expect(screen.queryByText(m.tour_got_it())).toBeNull();
        expect(nextDisabled()).toBe(true);
    });

    it("moves to the landmark step once the first is answered", () => {
        mount();

        press(61);
        next();

        expect(screen.getByRole("heading", { level: 2 }).textContent).toBe(m.tour_middle_c_title());
    });

    it("reports progress as steps, from nothing", () => {
        mount();

        expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("0");
    });

    it("shows the staff only once the keyboard steps are behind you", () => {
        mount();

        // Steps 1-4 are the keyboard itself.
        for (const answers of [[61], [MIDDLE_C], [60, 62, 64, 65, 67, 69, 71, 72], [61]]) {
            expect(document.querySelector("[data-staff]")).toBeNull();
            answers.forEach(press);
            next();
        }

        // Step 5 is the leap: a dot on the staff is a key under your hand.
        expect(document.querySelector("[data-staff]")).not.toBeNull();
        expect(screen.getByRole("heading", { level: 2 }).textContent).toBe(
            m.tour_note_to_key_title(),
        );
    });

    it("finishes only after the last step, and hands back to the page", () => {
        const view = mount();
        const walk = [[61], [MIDDLE_C], [60, 62, 64, 65, 67, 69, 71, 72], [61], [64], [60, 72]];

        for (const answers of walk) {
            expect(view.finished).not.toHaveBeenCalled();
            answers.forEach(press);
            expect(nextDisabled()).toBe(false);
            next();
        }

        expect(screen.getByText(m.tour_done_title())).toBeTruthy();
        expect(view.finished).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole("button", { name: m.tour_done_action() }));
        expect(view.finished).toHaveBeenCalledTimes(1);
    });
});
