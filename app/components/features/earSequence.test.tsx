// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ChordDegree } from "../../../core/theory";
import { m } from "../../paraglide/messages.js";
import { renderWithServices } from "../../testing/renderWithServices";
import { EarSequence } from "./earSequence";

afterEach(cleanup);

const SEQUENCE: ChordDegree[] = ["I", "IV", "V", "I"];
const VOCAB: ChordDegree[] = ["I", "IV", "V"];

const press = (name: string) => fireEvent.click(screen.getByRole("button", { name }));

describe("EarSequence announcements", () => {
    const mount = () =>
        render(
            <EarSequence
                sequence={SEQUENCE}
                choices={VOCAB}
                settled={false}
                onComplete={() => {}}
                label="progression"
            />,
        );

    it("announces each entry and where it landed in a live region", () => {
        mount();
        press("I");
        press("IV");
        const said = screen.getByText(
            m.ear_sequence_entered({ item: "IV", position: 2, total: 4 }),
        );
        expect(said.closest("[aria-live]")?.getAttribute("aria-live")).toBe("polite");
    });

    it("says nothing before the first entry", () => {
        mount();
        const region = screen.getByRole("status");
        expect(region.textContent).toBe("");
    });

    it("stops announcing an entry once it is undone", () => {
        mount();
        press("I");
        press("IV");
        fireEvent.click(screen.getByRole("button", { name: m.ear_progression_undo() }));
        expect(screen.getByRole("status").textContent).toBe("");
    });
});

describe("EarSequence digit legends", () => {
    afterEach(() => vi.unstubAllGlobals());

    // Which pointers the device has, as `(any-pointer: fine)` reports it.
    const pointer = (fine: boolean) =>
        vi.stubGlobal("matchMedia", (query: string) => ({
            matches: fine && query === "(any-pointer: fine)",
            addEventListener() {},
            removeEventListener() {},
        }));

    // Through the services world, so the evidence of a keyboard starts fresh per test.
    const mount = () =>
        renderWithServices(
            <EarSequence
                sequence={SEQUENCE}
                choices={VOCAB}
                settled={false}
                onComplete={() => {}}
                label="progression"
            />,
        );

    const badge = () => screen.getByRole("button", { name: "IV" }).querySelector("[aria-hidden]");
    const hint = () => screen.queryByText(m.ear_digit_hint());

    it("shows the corner digits and the hint where a fine pointer makes a keyboard likely", () => {
        pointer(true);
        mount();
        expect(badge()?.textContent).toBe("4");
        expect(hint()).toBeTruthy();
    });

    it("shows neither on a touch-only device", () => {
        pointer(false);
        mount();
        expect(badge()).toBeNull();
        expect(hint()).toBeNull();
    });

    it("shows both once a key press proves a keyboard, whatever the pointer", () => {
        // A tablet in a keyboard case: its main pointer is a finger, and it has keys.
        pointer(false);
        mount();
        act(() => {
            window.dispatchEvent(new KeyboardEvent("keydown", { key: "Shift", code: "ShiftLeft" }));
        });
        expect(badge()?.textContent).toBe("4");
        expect(hint()).toBeTruthy();
    });

    it("gives a chromatic degree no shortcut and no corner digit, and leaves 3 to the plain third", () => {
        // A dictation level offering the flat third beside the plain one: 3 can only mean one
        // of them, so the flat third answers by tap alone.
        pointer(true);
        const onComplete = vi.fn();
        renderWithServices(
            <EarSequence
                sequence={["1", "3"]}
                choices={["1", "♭3", "3"]}
                settled={false}
                onComplete={onComplete}
                label="melody"
            />,
        );
        const flat = screen.getByRole("button", { name: "♭3" });
        expect(flat.hasAttribute("aria-keyshortcuts")).toBe(false);
        expect(flat.querySelector("[aria-hidden]")).toBeNull();
        // A plain degree's label is its number already, so it carries the shortcut and no badge.
        const third = screen.getByRole("button", { name: "3" });
        expect(third.getAttribute("aria-keyshortcuts")).toBe("3");
        expect(third.querySelector("[aria-hidden]")).toBeNull();
        // One press at a time, as a player makes them: each is its own event and render.
        for (const [key, code] of [
            ["1", "Digit1"],
            ["3", "Digit3"],
        ]) {
            act(() => {
                window.dispatchEvent(new KeyboardEvent("keydown", { key, code }));
            });
        }
        expect(onComplete).toHaveBeenCalledWith("1-3");
    });

    it("takes nothing typed into a text field as proof", () => {
        // A phone's own on-screen keyboard only ever types into a field, so a key pressed
        // there says nothing about a keyboard the player could answer with.
        pointer(false);
        mount();
        const field = document.createElement("input");
        document.body.append(field);
        act(() => {
            field.dispatchEvent(
                new KeyboardEvent("keydown", { key: "a", code: "KeyA", bubbles: true }),
            );
        });
        field.remove();
        expect(badge()).toBeNull();
        expect(hint()).toBeNull();
    });
});

describe("EarSequence", () => {
    it("offers a keypad of the level's chords", () => {
        render(
            <EarSequence
                sequence={SEQUENCE}
                choices={VOCAB}
                settled={false}
                onComplete={() => {}}
                label="progression"
            />,
        );
        for (const degree of VOCAB) {
            expect(screen.getByRole("button", { name: degree })).toBeTruthy();
        }
    });

    it("emits the joined sequence only once every chord is entered", () => {
        const onComplete = vi.fn();
        render(
            <EarSequence
                sequence={SEQUENCE}
                choices={VOCAB}
                settled={false}
                onComplete={onComplete}
                label="progression"
            />,
        );
        press("I");
        press("IV");
        press("V");
        expect(onComplete).not.toHaveBeenCalled(); // three of four — not done
        press("I");
        expect(onComplete).toHaveBeenCalledWith("I-IV-V-I");
    });

    it("undoes the last chord before the sequence is complete", () => {
        const onComplete = vi.fn();
        render(
            <EarSequence
                sequence={SEQUENCE}
                choices={VOCAB}
                settled={false}
                onComplete={onComplete}
                label="progression"
            />,
        );
        press("I");
        press("IV");
        press(m.ear_progression_undo()); // take back the IV
        press("V"); // so the second chord is now V, not IV
        press("V");
        press("I");
        expect(onComplete).toHaveBeenCalledWith("I-V-V-I");
    });

    it("marks each slot right or wrong and reveals the answer once settled", () => {
        // The component fills its own entry while live, then the parent flips it to
        // settled with that entry preserved — the same instance, so a rerender models it.
        const props = {
            sequence: SEQUENCE,
            choices: VOCAB,
            onComplete: () => {},
            label: "progression",
        };
        const { rerender } = render(<EarSequence {...props} settled={false} />);
        press("I");
        press("V"); // wrong: should have been IV
        press("V");
        press("I");
        rerender(<EarSequence {...props} settled={true} />);

        // "IV" now appears twice: the keypad button, and the reveal in the wrong slot
        // (which was answered V) — before settling it was only the keypad.
        expect(screen.getAllByText("IV")).toHaveLength(2);
        // The wrong pick and both correct I's stay on screen.
        expect(screen.getAllByText("V").length).toBeGreaterThanOrEqual(1);
    });
});
