// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import { MidiProvider } from "../contexts/midi";
import { ScoreViewer } from "./scoreViewer";

// OSMD renders only in a real browser, so this runs in the browser project.
afterEach(() => {
    cleanup();
    localStorage.clear();
});

describe("ScoreViewer", () => {
    it("surfaces an error instead of a silently dead viewer when OSMD can't load", async () => {
        render(
            <MemoryRouter>
                <MidiProvider>
                    <ScoreViewer id="broken" xml="this is not MusicXML" title="Broken" />
                </MidiProvider>
            </MemoryRouter>,
        );
        // A score OSMD can't parse must report rather than leave the controls
        // disabled forever with no explanation.
        expect(
            await screen.findByText(/couldn't be displayed/, undefined, { timeout: 8000 }),
        ).toBeTruthy();
    });
});
