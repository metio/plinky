// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { act, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import { MidiProvider } from "../contexts/midi";
import { EarPiece } from "./earPiece";

const note = (n: number, step: string) =>
    `<measure number="${n}"><note><pitch><step>${step}</step><octave>4</octave></pitch><staff>1</staff></note></measure>`;
const XML = `<score-partwise><part id="P1">${note(1, "C")}${note(2, "D")}</part></score-partwise>`;

let mounted: HTMLElement[] = [];
afterEach(() => {
    for (const element of mounted) {
        element.remove();
    }
    mounted = [];
});

describe("EarPiece", () => {
    it("advances through the phrase as the right notes are played", async () => {
        const container = document.createElement("div");
        document.body.appendChild(container);
        mounted.push(container);
        render(
            <MemoryRouter>
                <MidiProvider>
                    <EarPiece xml={XML} />
                </MidiProvider>
            </MemoryRouter>,
            { container },
        );

        // The two-bar window's treble melody is C then D — two notes to reproduce.
        expect(await screen.findByText(/note 1 of 2/)).toBeTruthy();
        await act(async () => {
            window.__plinky?.play(60); // C4 — the first note of the phrase
        });
        expect(await screen.findByText(/note 2 of 2/)).toBeTruthy();
    });
});
