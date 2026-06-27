// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import { loadUserScores } from "../lib/catalog";
import { generatePhrase } from "../lib/generator";
import LibraryImportRoute from "./libraryImport";

const mount = () =>
    render(
        <MemoryRouter>
            <LibraryImportRoute />
        </MemoryRouter>,
    );

const fileInput = () => document.querySelector('input[type="file"]') as HTMLInputElement;

const drop = (input: HTMLInputElement, file: File) =>
    fireEvent.change(input, { target: { files: [file] } });

afterEach(() => {
    cleanup();
    localStorage.clear();
});

describe("LibraryImportRoute", () => {
    it("previews a dropped MusicXML file, then imports it with edited fields", async () => {
        const phrase = generatePhrase({ bars: 1, beatsPerBar: 4, twoHands: false }, () => 0.5);
        mount();
        drop(fileInput(), new File([phrase], "tune.musicxml", { type: "application/xml" }));

        // The editable preview appears once the file is read and parsed.
        const title = (await screen.findByLabelText("Title")) as HTMLInputElement;
        fireEvent.change(title, { target: { value: "My Étude" } });
        fireEvent.click(screen.getByText("Add to my library"));

        // It is confirmed and persisted as a user score under the edited title.
        expect(await screen.findByText(/Added to your library/)).toBeTruthy();
        await waitFor(() =>
            expect(loadUserScores().some((score) => score.title === "My Étude")).toBe(true),
        );
    });

    it("rejects a file with no playable notes", async () => {
        mount();
        drop(fileInput(), new File(["<not-musicxml/>"], "broken.xml", { type: "application/xml" }));
        expect(await screen.findByText(/No playable notes/)).toBeTruthy();
        // No preview is offered for a file that can't be played.
        expect(screen.queryByText("Add to my library")).toBeNull();
    });
});
