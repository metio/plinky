// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fakeMidi } from "../../adapters/fakeMidi";
import { memoryStore } from "../../adapters/memoryStore";
import { MidiProvider } from "../../contexts/midi";
import { ServicesProvider } from "../../contexts/services";
import { ComposeStage } from "./composeStage";

const mount = (fullscreen: boolean, onExitFullscreen = () => {}) =>
    render(
        <MemoryRouter>
            <ServicesProvider services={{ store: memoryStore(), midi: fakeMidi() }}>
                <MidiProvider>
                    <ComposeStage
                        staffXml={null}
                        keyWindow={{ from: 48, to: 72 }}
                        controls={<button type="button">controls-slot</button>}
                        stageRef={createRef<HTMLElement>()}
                        fullscreen={fullscreen}
                        onExitFullscreen={onExitFullscreen}
                    />
                </MidiProvider>
            </ServicesProvider>
        </MemoryRouter>,
    );

afterEach(cleanup);

describe("ComposeStage", () => {
    it("rests as just the controls and the sketch — no keyboard, no MIDI chrome", () => {
        mount(false);
        expect(screen.getByRole("button", { name: "controls-slot" })).toBeTruthy();
        expect(screen.getByText("Play a few notes and they'll appear here.")).toBeTruthy();
        // No on-screen keys, no connect button, no computer-keys disclosure —
        // device setup lives in Settings alone.
        expect(screen.queryByLabelText("Hide keys")).toBeNull();
        expect(screen.queryByRole("button", { name: "Connect MIDI" })).toBeNull();
        expect(screen.queryByText(/No piano\?/)).toBeNull();
        expect(screen.queryByLabelText("Exit full screen")).toBeNull();
    });

    it("shows the keys with play's quick controls only in full screen", () => {
        const onExit = vi.fn();
        mount(true, onExit);
        // The overlay pins the stage over the page.
        const stage = document.querySelector("section") as HTMLElement;
        expect(stage.className).toContain("fixed");
        // The keys and their fold-away/label controls, same components as play.
        expect(screen.getByLabelText("Hide keys")).toBeTruthy();
        fireEvent.click(screen.getByLabelText("Exit full screen"));
        expect(onExit).toHaveBeenCalledTimes(1);
    });

    it("folds the keyboard away and back with the quick control", () => {
        mount(true);
        expect(screen.getByLabelText("C4")).toBeTruthy();

        fireEvent.click(screen.getByLabelText("Hide keys"));
        // The keys leave the layout entirely — their strip belongs to the staff
        // now — while the toggle stays on the sketch's corner as the way back.
        expect(screen.queryByLabelText("C4")).toBeNull();
        expect(screen.getByLabelText("Show keys")).toBeTruthy();

        fireEvent.click(screen.getByLabelText("Show keys"));
        expect(screen.getByLabelText("C4")).toBeTruthy();
    });
});
