// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import type { ExerciseConfig } from "../../../core/exerciseGen";
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
