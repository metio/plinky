// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import { exercises } from "../lib/exercises";
import { buildExercise, saveUserSong } from "../lib/songs";
import Home from "./home";

afterEach(() => {
    cleanup();
    localStorage.clear();
});

function renderHome() {
    return render(
        <MemoryRouter>
            <Home />
        </MemoryRouter>,
    );
}

describe("Home", () => {
    it("lists every built-in exercise by title", () => {
        renderHome();
        for (const exercise of exercises) {
            expect(screen.getByText(exercise.title)).toBeTruthy();
        }
    });

    it("links each exercise to every practice mode", () => {
        renderHome();
        const hrefs = [...document.querySelectorAll("a")].map((anchor) =>
            anchor.getAttribute("href"),
        );
        const first = exercises[0].id;
        for (const mode of ["practice", "time-trial", "rhythm", "tempo"]) {
            expect(hrefs).toContain(`/${mode}/${first}`);
        }
    });

    it("offers an export control for every exercise", () => {
        renderHome();
        expect(screen.getAllByText("Export")).toHaveLength(exercises.length);
    });

    it("lists imported songs with a remove control, but not built-ins", () => {
        saveUserSong(buildExercise("X:1\nT:My Import\nM:4/4\nL:1/4\nK:C\nC D E F |", []));
        renderHome();
        expect(screen.getByText("My Import")).toBeTruthy();
        // Only the imported song is removable.
        expect(screen.getAllByText("Remove")).toHaveLength(1);
        expect(screen.getAllByText("Export")).toHaveLength(exercises.length + 1);
    });
});
