// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MidiProvider } from "../contexts/midi";
import { loadPrefs } from "../lib/prefs";
import { HandSize } from "./handSize";

afterEach(() => {
    cleanup();
    localStorage.clear();
});

const mount = () =>
    render(
        <MidiProvider>
            <HandSize />
        </MidiProvider>,
    );

// Tap a key on the on-screen keyboard, which feeds the same note funnel as MIDI.
const tap = (note: string) => fireEvent.pointerDown(screen.getByLabelText(note));

describe("HandSize", () => {
    it("captures a span from two keys and persists it for one hand", () => {
        mount();
        expect(screen.getAllByText("Not set")).toHaveLength(2);

        fireEvent.click(screen.getAllByText("Set")[0]!); // left hand
        tap("C4"); // thumb
        tap("A4"); // pinky → a major sixth (9 semitones)
        expect(screen.getByText(/C4 → A4 · 9 semitones/)).toBeTruthy();

        fireEvent.click(screen.getByText("Save"));
        // Only the right hand remains unset, and the left span is stored.
        expect(screen.getAllByText("Not set")).toHaveLength(1);
        expect(loadPrefs().handSpan).toEqual({ left: 9, right: null });
    });

    it("clears a measured hand back to unset", () => {
        mount();
        fireEvent.click(screen.getAllByText("Set")[1]!); // right hand
        tap("C4");
        tap("A4");
        fireEvent.click(screen.getByText("Save"));
        expect(loadPrefs().handSpan).toEqual({ left: null, right: 9 });

        fireEvent.click(screen.getByText("Remove"));
        expect(screen.getAllByText("Not set")).toHaveLength(2);
        expect(loadPrefs().handSpan).toEqual({ left: null, right: null });
    });
});
