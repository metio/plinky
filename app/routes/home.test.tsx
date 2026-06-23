// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
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
    it("always offers the no-song training modes", () => {
        renderHome();
        for (const label of ["Sight-reading sprint →", "Daily challenge →", "Ear training →"]) {
            expect(screen.getByText(label)).toBeTruthy();
        }
    });

    it("lists a local song with mode links and a remove control", async () => {
        saveUserSong(buildExercise("X:1\nT:My Song\nM:4/4\nL:1/4\nK:C\nC D E F |", []));
        renderHome();
        expect(await screen.findByText("My Song")).toBeTruthy();
        const hrefs = [...document.querySelectorAll("a")].map((anchor) =>
            anchor.getAttribute("href"),
        );
        for (const mode of ["practice", "time-trial", "rhythm", "tempo", "loop"]) {
            expect(hrefs).toContain(`/${mode}/my-song`);
        }
        expect(screen.getAllByText("Remove")).toHaveLength(1);
    });

    it("shows an empty state with no songs", async () => {
        renderHome();
        expect(await screen.findByText(/No songs on this device yet/)).toBeTruthy();
    });
});
