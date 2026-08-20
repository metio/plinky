// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RHYTHM_LEVELS } from "../../core/rhythmPattern";
import { fakeAudioEngine } from "../adapters/fakeAudioEngine";
import { fakeMidi } from "../adapters/fakeMidi";
import { memoryStore } from "../adapters/memoryStore";
import { MidiProvider } from "../contexts/midi";
import { createServices, ServicesProvider } from "../contexts/services";
import { createActivitySignal } from "../lib/activity";
import { m } from "../paraglide/messages.js";
import { choose, chosen } from "../testing/controls";
import { fakeScheduler } from "../testing/fakeScheduler";
import Rhythm from "./rhythm";

afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
});

function mount() {
    const services = createServices({
        audio: fakeAudioEngine(),
        store: memoryStore(),
        midi: fakeMidi(),
        scheduler: fakeScheduler(),
        activity: createActivitySignal(),
    });
    return render(
        <ServicesProvider services={services}>
            <MemoryRouter>
                <MidiProvider>
                    <Rhythm />
                </MidiProvider>
            </MemoryRouter>
        </ServicesProvider>,
    );
}

describe("the rhythm page", () => {
    it("offers every rung of the ladder, numbered", () => {
        // Numbered rather than named on purpose: what a level contains is the notation on
        // the page, and a name for it would be a word to learn before the thing it names.
        mount();
        const rungs = screen
            .getByRole("tablist", { name: m.rhythm_level_label() })
            .querySelectorAll('[role="tab"]');
        expect([...rungs].map((rung) => rung.textContent)).toEqual(
            RHYTHM_LEVELS.map((_, index) => String(index + 1)),
        );
        expect(chosen(m.rhythm_level_label())).toBe("1");
    });

    it("draws a new rhythm when a different level is chosen", () => {
        mount();
        const first = document.querySelector("svg")?.outerHTML;
        choose(m.rhythm_level_label(), "9");
        expect(document.querySelector("svg")?.outerHTML).not.toBe(first);
    });

    it("lets the tempo be set, and redraws at the new one", () => {
        // The rhythm is read at the tempo the reader can hold, not at one the page picked.
        mount();
        const slider = screen.getByRole("slider");
        fireEvent.change(slider, { target: { value: "120" } });
        expect(screen.getByText("120")).toBeTruthy();
    });

    it("needs no piano to be usable", () => {
        // The whole point of the page: a rhythm has no pitch, so a reader with no
        // instrument at all can still work on it.
        mount();
        expect(screen.getByRole("button", { name: m.rhythm_tap() })).toBeTruthy();
    });
});
