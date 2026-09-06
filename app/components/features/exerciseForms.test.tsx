// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import type { ExerciseConfig } from "../../../core/exerciseGen";
import { m } from "../../paraglide/messages.js";
import { ExerciseForms } from "./exerciseForms";

afterEach(cleanup);

const config = (overrides: Partial<ExerciseConfig> = {}): ExerciseConfig => ({
    type: "major-scale",
    key: "c",
    octaves: 1,
    hands: "right",
    inversion: 0,
    interval: "single",
    ...overrides,
});

const renderForms = (c: ExerciseConfig) =>
    render(
        <MemoryRouter>
            <ExerciseForms config={c} />
        </MemoryRouter>,
    );

describe("ExerciseForms interval controls", () => {
    it("offers thirds and sixths for a scale that supports them", () => {
        renderForms(config({ type: "major-scale", hands: "right" }));
        expect(screen.getByRole("link", { name: /thirds/i })).toBeTruthy();
        expect(screen.getByRole("link", { name: /sixths/i })).toBeTruthy();
    });

    it("hides intervals under contrary motion, which double stops don't combine with", () => {
        renderForms(config({ type: "major-scale", hands: "contrary" }));
        expect(screen.queryByRole("link", { name: /thirds/i })).toBeNull();
    });

    it("hides intervals for a scale type that has no double stops", () => {
        renderForms(config({ type: "chromatic-scale", hands: "right" }));
        expect(screen.queryByRole("link", { name: /thirds/i })).toBeNull();
    });
});

describe("ExerciseForms hand controls", () => {
    it("offers contrary motion for a scale, which has a mirror form", () => {
        renderForms(config({ type: "major-scale" }));
        expect(screen.getByRole("link", { name: m.exercise_hand_contrary() })).toBeTruthy();
    });

    it("does not offer contrary motion for a chord set, which both hands play in parallel", () => {
        renderForms(config({ type: "major-chords", hands: "both" }));
        expect(screen.queryByRole("link", { name: m.exercise_hand_contrary() })).toBeNull();
        expect(screen.getByRole("link", { name: m.exercise_hand_both() })).toBeTruthy();
    });

    it("does not offer contrary motion for an arpeggio either", () => {
        renderForms(config({ type: "major-arpeggio" }));
        expect(screen.queryByRole("link", { name: m.exercise_hand_contrary() })).toBeNull();
    });
});
