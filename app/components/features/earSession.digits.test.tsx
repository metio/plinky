// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import { act, cleanup, fireEvent, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { EarExerciseId } from "../../../core/earExercise";
import { DEFAULT_KEY_MAP, rebind } from "../../../core/keyMap";
import { fakeAudioEngine } from "../../adapters/fakeAudioEngine";
import { fakeMidi } from "../../adapters/fakeMidi";
import { MidiProvider, useMidiInput } from "../../contexts/midi";
import { m } from "../../paraglide/messages.js";
import { renderWithServices } from "../../testing/renderWithServices";
import { EarSession } from "./earSession";

const { heard } = vi.hoisted(() => ({ heard: [] as number[] }));

afterEach(() => {
    cleanup();
    heard.length = 0;
    vi.restoreAllMocks();
});

// A surface playing the computer keyboard, mounted beside the drill. No page puts one
// there today; it stands in for any that does, so what a digit sounds is observable.
function PianoKeys() {
    useMidiInput({ keys: true, onNoteOn: (event) => heard.push(event.note) });
    return null;
}

// Pinned to the floor, so the first option is always the one asked: the scale-degree triad
// asks for 1, and the progression and dictation start from the key's first degree.
function mount(exercise: EarExerciseId, level = 0) {
    vi.spyOn(Math, "random").mockReturnValue(0);
    return renderWithServices(
        <MidiProvider>
            <PianoKeys />
            <EarSession exercise={exercise} level={level} autoStart={true} />
        </MidiProvider>,
        { audio: fakeAudioEngine(), midi: fakeMidi() },
    );
}

const press = (key: string, target: EventTarget = window) =>
    act(() => {
        target.dispatchEvent(
            new KeyboardEvent("keydown", { key, code: `Digit${key}`, bubbles: true }),
        );
        target.dispatchEvent(
            new KeyboardEvent("keyup", { key, code: `Digit${key}`, bubbles: true }),
        );
    });

// A press as a layout reports it: the glyph it types, the physical key it sits on.
const pressOn = (key: string, code: string, init: KeyboardEventInit = {}) =>
    act(() => {
        window.dispatchEvent(new KeyboardEvent("keydown", { key, code, bubbles: true, ...init }));
        window.dispatchEvent(new KeyboardEvent("keyup", { key, code, bubbles: true, ...init }));
    });

const unanswered = () => screen.getByText(m.ear_prompt());

describe("EarSession number keys", () => {
    it("answers a scale-degree question with the degree typed, and sounds nothing", () => {
        mount("scale-degrees");
        press("1");
        expect(screen.getByText(m.ear_verdict_right())).toBeTruthy();
        expect(screen.getByText(m.ear_score({ correct: 1, asked: 1 }))).toBeTruthy();
        expect(heard).toEqual([]);
    });

    it("answers with a degree other than the one asked, and marks it wrong", () => {
        mount("scale-degrees");
        press("3");
        expect(screen.getByText(m.ear_verdict_close())).toBeTruthy();
        expect(screen.getByText(m.ear_score({ correct: 0, asked: 1 }))).toBeTruthy();
        expect(heard).toEqual([]);
    });

    it("leaves a digit the question does not offer to the piano", () => {
        mount("scale-degrees");
        // The triad level offers 1, 3 and 5. 8 answers nothing and plays nothing; 2 answers
        // nothing and is still the piano key it always was.
        press("8");
        unanswered();
        expect(heard).toEqual([]);
        press("2");
        unanswered();
        expect(heard).toHaveLength(1);
    });

    it("names each digit's button as its shortcut and says the keys answer", () => {
        mount("scale-degrees");
        expect(screen.getByRole("button", { name: "3" }).getAttribute("aria-keyshortcuts")).toBe(
            "3",
        );
        expect(screen.getByText(m.ear_digit_hint())).toBeTruthy();
    });

    it("leaves a digit typed into a text field alone", () => {
        mount("scale-degrees");
        const field = document.createElement("input");
        document.body.append(field);
        field.focus();
        press("1", field);
        unanswered();
        expect(heard).toEqual([]);
        field.remove();
    });

    it("ignores digits once the question is answered, and the piano has them back", () => {
        mount("scale-degrees");
        fireEvent.click(screen.getByRole("button", { name: "1" }));
        press("3");
        expect(screen.getByText(m.ear_score({ correct: 1, asked: 1 }))).toBeTruthy();
        expect(heard).toHaveLength(1);
    });

    it("writes a melody down from the number keys", () => {
        mount("melodic-dictation");
        const slots = screen.getByRole("group", { name: m.ear_melodic_choices() });
        press("1");
        press("2");
        expect(within(slots).getByText("1")).toBeTruthy();
        expect(within(slots).getByText("2")).toBeTruthy();
        press("3");
        // Three notes on the shortest level, so the third digit hands the answer in.
        expect(screen.getByRole("button", { name: m.ear_next() })).toBeTruthy();
        expect(heard).toEqual([]);
    });

    it("takes 4 as IV in a progression, and prints the key beside the numeral", () => {
        mount("progressions");
        const slots = screen.getByRole("group", { name: m.ear_progression_choices() });
        press("4");
        expect(within(slots).getByText("IV")).toBeTruthy();
        expect(heard).toEqual([]);
        // The accessible name stays the numeral; the digit is its shortcut.
        const four = screen.getByRole("button", { name: "IV" });
        expect(four.getAttribute("aria-keyshortcuts")).toBe("4");
        expect(screen.getByText(m.ear_digit_hint())).toBeTruthy();
    });

    it("leaves every digit to the piano on a question answered at the keyboard", () => {
        mount("perfect-pitch");
        press("3");
        expect(heard).toHaveLength(1);
        expect(screen.getByText(m.ear_score({ correct: 0, asked: 0 }))).toBeTruthy();
        expect(screen.queryByText(m.ear_digit_hint())).toBeNull();
    });

    it("offers no shortcut where the answers have no numbers", () => {
        mount("chords");
        expect(screen.queryByText(m.ear_digit_hint())).toBeNull();
        press("1");
        unanswered();
    });

    it("answers from the number row on a layout that types a symbol there", () => {
        // French AZERTY without Shift: the key printed 3 types ".
        mount("scale-degrees");
        pressOn('"', "Digit3");
        expect(screen.getByText(m.ear_verdict_close())).toBeTruthy();
        expect(heard).toEqual([]);
    });

    it("answers from the number row with Shift held, as AZERTY types digits", () => {
        mount("scale-degrees");
        pressOn("1", "Digit1", { shiftKey: true });
        expect(screen.getByText(m.ear_verdict_right())).toBeTruthy();
        expect(heard).toEqual([]);
    });

    it("answers from the number pad", () => {
        mount("scale-degrees");
        pressOn("1", "Numpad1");
        expect(screen.getByText(m.ear_verdict_right())).toBeTruthy();
    });

    it("fills a progression from the AZERTY number row", () => {
        mount("progressions");
        const slots = screen.getByRole("group", { name: m.ear_progression_choices() });
        pressOn("'", "Digit4");
        expect(within(slots).getByText("IV")).toBeTruthy();
        expect(heard).toEqual([]);
    });

    it("never sounds a key the player bound to a note while it answers", () => {
        const view = mount("scale-degrees");
        // "&" — the AZERTY key printed 1 — plays the right hand's C in place of Q.
        act(() => {
            view.services.prefs.save({
                ...view.services.prefs.load(),
                keyMap: rebind(DEFAULT_KEY_MAP, "right", 0, "&"),
            });
        });
        pressOn("&", "Digit1");
        expect(screen.getByText(m.ear_verdict_right())).toBeTruthy();
        expect(heard).toEqual([]);
        // Answered, the question lets go of the key, and it plays the note it is bound to.
        pressOn("&", "Digit1");
        expect(heard).toHaveLength(1);
    });

    it("answers the same way when a player has bound a digit to a note", () => {
        const view = mount("scale-degrees");
        // "1" plays the right hand's C now, in place of Q.
        act(() => {
            view.services.prefs.save({
                ...view.services.prefs.load(),
                keyMap: rebind(DEFAULT_KEY_MAP, "right", 0, "1"),
            });
        });
        press("1");
        expect(screen.getByText(m.ear_verdict_right())).toBeTruthy();
        expect(heard).toEqual([]);
        // Answered, the question lets go of the key, and it plays the note it is bound to.
        press("1");
        expect(heard).toHaveLength(1);
    });
});
