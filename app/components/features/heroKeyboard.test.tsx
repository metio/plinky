// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MidiProvider, useMidiConnection } from "../../contexts/midi";
import { HeroKeyboard } from "./heroKeyboard";

afterEach(cleanup);

// The hero listens for MIDI, so it renders inside the provider the app supplies.
const renderHero = () =>
    render(
        <MidiProvider>
            <HeroKeyboard />
        </MidiProvider>,
    );

describe("HeroKeyboard", () => {
    it("renders one octave of labelled keys", () => {
        renderHero();
        // C4–C5: 8 white + 5 black keys, each a labelled button.
        expect(screen.getAllByRole("button")).toHaveLength(13);
        expect(screen.getByLabelText("C 4")).toBeTruthy();
        expect(screen.getByLabelText("C 5")).toBeTruthy();
    });

    it("lights a key when it is pressed", () => {
        // No AudioContext under jsdom, so the synth no-ops — the press still lights up.
        renderHero();
        const key = screen.getByLabelText("C 4");
        fireEvent.pointerDown(key);
        expect(key.className).toContain("bg-green-200");
    });

    it("lights up when a note arrives from the input funnel (a MIDI key)", () => {
        function Harness() {
            const { pressKey } = useMidiConnection();
            return (
                <>
                    <button type="button" onClick={() => pressKey(60)}>
                        play
                    </button>
                    <HeroKeyboard />
                </>
            );
        }
        render(
            <MidiProvider>
                <Harness />
            </MidiProvider>,
        );
        fireEvent.click(screen.getByText("play"));
        expect(screen.getByLabelText("C 4").className).toContain("bg-green-200");
    });
});
