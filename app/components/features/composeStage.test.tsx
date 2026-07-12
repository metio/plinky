// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import { fakeMidi } from "../../adapters/fakeMidi";
import { memoryStore } from "../../adapters/memoryStore";
import { MidiProvider } from "../../contexts/midi";
import { ServicesProvider } from "../../contexts/services";
import { ComposeStage } from "./composeStage";

const mount = (staffXml: string | null = null) =>
    render(
        <MemoryRouter>
            <ServicesProvider services={{ store: memoryStore(), midi: fakeMidi() }}>
                <MidiProvider>
                    <ComposeStage
                        staffXml={staffXml}
                        keyWindow={{ from: 48, to: 72 }}
                        controls={<button type="button">controls-slot</button>}
                    />
                </MidiProvider>
            </ServicesProvider>
        </MemoryRouter>,
    );

afterEach(cleanup);

describe("ComposeStage", () => {
    it("renders the controls slot, the empty-staff hint and the keyboard chrome", () => {
        mount();
        expect(screen.getByRole("button", { name: "controls-slot" })).toBeTruthy();
        expect(screen.getByText("Play a few notes and they'll appear here.")).toBeTruthy();
        // The play page's connect prompt and the computer-keys hint, shared here.
        expect(screen.getByRole("button", { name: "Connect MIDI" })).toBeTruthy();
        expect(screen.getByText("No piano? Play with your computer keyboard:")).toBeTruthy();
        expect(screen.getByRole("button", { name: "Full screen" })).toBeTruthy();
    });

    it("switches to the full-screen overlay and back", () => {
        const { container } = mount();
        fireEvent.click(screen.getByRole("button", { name: "Full screen" }));
        // jsdom has no Fullscreen API, so the hook falls back to the in-page
        // overlay: the stage pins itself over the viewport.
        const stage = container.querySelector("section") as HTMLElement;
        expect(stage.className).toContain("fixed");
        // The keys are the surface in full screen; the mapping hint folds away.
        expect(screen.queryByText("No piano? Play with your computer keyboard:")).toBeNull();
        fireEvent.click(screen.getByRole("button", { name: "Exit full screen" }));
        expect(stage.className).not.toContain("fixed");
    });
});
