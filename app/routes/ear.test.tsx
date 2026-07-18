// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fakeAudioEngine } from "../adapters/fakeAudioEngine";
import { memoryStore } from "../adapters/memoryStore";
import { createServices, ServicesProvider } from "../contexts/services";
import { createActivitySignal } from "../lib/activity";
import { m } from "../paraglide/messages.js";
import { choose, chosen } from "../testing/controls";
import Ear from "./ear";

afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
});

// The route reads the query string, so it renders inside a router at a chosen entry.
function renderAt(entry: string) {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const services = createServices({
        audio: fakeAudioEngine(),
        store: memoryStore(),
        activity: createActivitySignal(),
    });
    return render(
        <ServicesProvider services={services}>
            <MemoryRouter initialEntries={[entry]}>
                <Ear />
            </MemoryRouter>
        </ServicesProvider>,
    );
}

describe("ear route", () => {
    it("offers the exercise and level choosers, resting on intervals", () => {
        renderAt("/ear");
        expect(chosen(m.ear_exercise_label)).toBe(m.ear_exercise_intervals());
        expect(screen.getByText(m.ear_level_help())).toBeTruthy();
        // The drill mounts below the choosers, resting on its start card.
        expect(screen.getByRole("button", { name: m.ear_start() })).toBeTruthy();
    });

    it("hides the level chooser for an exercise without levels", () => {
        renderAt("/ear");
        expect(screen.queryByText(m.ear_level_help())).toBeTruthy();
        choose(m.ear_exercise_label, m.ear_exercise_perfect_pitch);
        expect(screen.queryByText(m.ear_level_help())).toBeNull();
    });

    it("opens on the exercise and level named in the query", () => {
        renderAt("/ear?exercise=intervals&level=2");
        expect(chosen(m.ear_exercise_label)).toBe(m.ear_exercise_intervals());
        expect(chosen(m.ear_level_label)).toBe(m.ear_level_seconds());
    });

    it("opens on perfect pitch from the query, with no level chooser", () => {
        renderAt("/ear?exercise=perfect-pitch");
        expect(chosen(m.ear_exercise_label)).toBe(m.ear_exercise_perfect_pitch());
        expect(screen.queryByText(m.ear_level_help())).toBeNull();
    });

    it("ignores an out-of-range level in the query", () => {
        renderAt("/ear?exercise=intervals&level=99");
        expect(chosen(m.ear_level_label)).toBe(m.ear_level_fifths());
    });

    it("offers chords and scales, each with its own level names", () => {
        renderAt("/ear?exercise=chords&level=1");
        expect(chosen(m.ear_exercise_label)).toBe(m.ear_exercise_chords());
        expect(chosen(m.ear_level_label)).toBe(m.ear_chord_level_triads());

        cleanup();
        renderAt("/ear?exercise=scales&level=2");
        expect(chosen(m.ear_exercise_label)).toBe(m.ear_exercise_scales());
        expect(chosen(m.ear_level_label)).toBe(m.ear_scale_level_modes());
    });

    it("offers chord progressions with their own level names", () => {
        renderAt("/ear?exercise=progressions&level=0");
        expect(chosen(m.ear_exercise_label)).toBe(m.ear_exercise_progressions());
        expect(chosen(m.ear_level_label)).toBe(m.ear_prog_level_primary());
    });
});
