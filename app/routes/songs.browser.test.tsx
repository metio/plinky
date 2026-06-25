// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import { MidiProvider } from "../contexts/midi";
import { buildSong, saveUserSong } from "../lib/catalog";
import Songs from "./songs";

const USER_XML = `<?xml version="1.0"?><score-partwise><work><work-title>My Tune</work-title></work><part id="P1"><measure number="1"><note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration></note></measure></part></score-partwise>`;

// OSMD renders only in a real browser, so this runs in the browser project.
afterEach(() => {
    cleanup();
    localStorage.clear();
});

function renderSongs() {
    return render(
        <MemoryRouter>
            <MidiProvider>
                <Songs />
            </MidiProvider>
        </MemoryRouter>,
    );
}

describe("Songs catalogue", () => {
    it("lists bundled scores and renders the selected one with OSMD", async () => {
        renderSongs();
        expect(await screen.findByText("Ode to Joy")).toBeTruthy();
        // The auto-selected first piece renders through the score viewer.
        await waitFor(() => expect(document.querySelector("svg")).toBeTruthy(), { timeout: 8000 });
        expect(screen.getByText(/Listen/)).toBeTruthy();
        expect(screen.getByText("Practice")).toBeTruthy();
    });

    it("filters the list by the search box", async () => {
        renderSongs();
        await screen.findByText("Ode to Joy");
        fireEvent.change(screen.getByRole("searchbox"), {
            target: { value: "no-such-piece" },
        });
        expect(await screen.findByText("No songs match your search.")).toBeTruthy();
    });

    it("selects a piece when its title is clicked", async () => {
        renderSongs();
        const scale = await screen.findByText("C major scale");
        fireEvent.click(scale);
        await waitFor(() => expect(document.querySelector("svg")).toBeTruthy(), { timeout: 8000 });
    });

    it("stars and unstars a piece", async () => {
        renderSongs();
        await screen.findByText("Ode to Joy");
        const star = screen.getAllByLabelText("Add to favorites")[0];
        if (!star) {
            throw new Error("no favorite control");
        }
        fireEvent.click(star);
        expect(await screen.findByLabelText("Remove from favorites")).toBeTruthy();
    });

    it("removes an imported song from the catalogue", async () => {
        saveUserSong(buildSong(USER_XML, []));
        renderSongs();
        expect(await screen.findByText("My Tune")).toBeTruthy();
        fireEvent.click(screen.getByLabelText("Remove"));
        await waitFor(() => expect(screen.queryByText("My Tune")).toBeNull());
    });
});
