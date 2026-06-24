// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import { loadFavorites } from "../lib/favorites";
import { buildExercise, loadUserSongs, saveUserSong } from "../lib/songs";
import Songs from "./songs";

afterEach(() => {
    cleanup();
    localStorage.clear();
});

function seed(title: string) {
    saveUserSong(buildExercise(`X:1\nT:${title}\nM:4/4\nL:1/4\nK:C\nC D E F |`, []));
}

function renderSongs() {
    return render(
        <MemoryRouter>
            <Songs />
        </MemoryRouter>,
    );
}

describe("Songs", () => {
    it("filters the list by the search box", () => {
        seed("Alpha");
        seed("Beta");
        renderSongs();
        expect(screen.getByText("Alpha")).toBeTruthy();
        expect(screen.getByText("Beta")).toBeTruthy();

        // Lower-case query exercises the case-insensitive match against "Alpha".
        fireEvent.change(screen.getByPlaceholderText("Search songs…"), {
            target: { value: "alpha" },
        });
        expect(screen.getByText("Alpha")).toBeTruthy();
        expect(screen.queryByText("Beta")).toBeNull();
    });

    it("stars a song and filters to favorites", () => {
        seed("Alpha");
        seed("Beta");
        renderSongs();

        const alpha = screen.getByText("Alpha").closest("li") as HTMLElement;
        fireEvent.click(within(alpha).getByLabelText("Add to favorites"));
        expect([...loadFavorites()]).toEqual(["alpha"]);

        fireEvent.click(screen.getByText("★ Favorites"));
        expect(screen.getByText("Alpha")).toBeTruthy();
        expect(screen.queryByText("Beta")).toBeNull();
    });

    it("removes a song from the device", () => {
        seed("Alpha");
        renderSongs();
        fireEvent.click(screen.getByText("Remove"));
        expect(loadUserSongs()).toHaveLength(0);
        expect(screen.queryByText("Alpha")).toBeNull();
    });
});
