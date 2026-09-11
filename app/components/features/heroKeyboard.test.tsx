// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { fakeAudioEngine } from "../../adapters/fakeAudioEngine";
import { fakeMidi } from "../../adapters/fakeMidi";
import { MidiProvider, useMidiConnection } from "../../contexts/midi";
import { renderWithServices } from "../../testing/renderWithServices";
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
        expect(key.className).toContain("bg-success-fill");
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
        expect(screen.getByLabelText("C 4").className).toContain("bg-success-fill");
    });

    it("ends the voice of a key still held down when the hero goes", () => {
        // The drawn keys let a held key go as they unmount, and that release reaches the
        // funnel only after the hero has stopped listening to it, so the hero has to end
        // the voice itself.
        const audio = fakeAudioEngine();
        const tree = (shown: boolean) => <MidiProvider>{shown && <HeroKeyboard />}</MidiProvider>;
        const view = renderWithServices(tree(true), { audio, midi: fakeMidi() });
        fireEvent.pointerDown(screen.getByLabelText("C 4"));
        expect(audio.voices).toEqual([{ kind: "press", note: 60, gain: expect.any(Number) }]);
        view.rerender(tree(false));
        expect(audio.voices.at(-1)).toMatchObject({ kind: "release", note: 60 });
    });
});
