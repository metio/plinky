// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
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

// The real staff pulls in OpenSheetMusicDisplay and engraves asynchronously; what matters
// here is only that it reports having drawn, which is the signal the panel follows.
vi.mock("./staffPreview", () => ({
    StaffPreview: ({ onRendered }: { onRendered?: () => void }) => {
        onRendered?.();
        return <div data-testid="staff" />;
    },
}));

const mount = (fullscreen: boolean, onExitFullscreen = () => {}, staffXml: string | null = null) =>
    render(
        <MemoryRouter>
            <ServicesProvider services={{ store: memoryStore(), midi: fakeMidi() }}>
                <MidiProvider>
                    <ComposeStage
                        staffXml={staffXml}
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
    it("rests as the controls, the sketch and the keys — no MIDI chrome", () => {
        mount(false);
        expect(screen.getByRole("button", { name: "controls-slot" })).toBeTruthy();
        expect(screen.getByText("Play a few notes and they'll appear here.")).toBeTruthy();
        // The keys are the only input a phone has, and the page's opening line promises
        // them, so they are here before full screen is.
        expect(screen.getByLabelText("C 4")).toBeTruthy();
        // No connect button, no computer-keys disclosure — device setup lives in
        // Settings alone — and no full-screen chrome until full screen.
        expect(screen.queryByRole("button", { name: "Connect MIDI" })).toBeNull();
        expect(screen.queryByText(/No piano\?/)).toBeNull();
        expect(screen.queryByLabelText("Hide keys")).toBeNull();
        expect(screen.queryByLabelText("Exit full screen")).toBeNull();
    });

    it("adds play's quick controls and the overlay in full screen", () => {
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
        expect(screen.getByLabelText("C 4")).toBeTruthy();

        fireEvent.click(screen.getByLabelText("Hide keys"));
        // The keys leave the layout entirely — their strip belongs to the staff
        // now — while the toggle stays on the sketch's corner as the way back.
        expect(screen.queryByLabelText("C 4")).toBeNull();
        expect(screen.getByLabelText("Show keys")).toBeTruthy();

        fireEvent.click(screen.getByLabelText("Show keys"));
        expect(screen.getByLabelText("C 4")).toBeTruthy();
    });
});

// The sketch's own scroll panel — the staff's parent, since the full-screen wrapper
// around it scrolls as well — given a real geometry, which jsdom gives no element.
function sizePanel(scrollHeight: number, clientHeight: number) {
    const panel = screen.getByTestId("staff").parentElement;
    if (!panel) {
        throw new Error("no scroll panel");
    }
    Object.defineProperty(panel, "scrollHeight", { value: scrollHeight, configurable: true });
    Object.defineProperty(panel, "clientHeight", { value: clientHeight, configurable: true });
    return panel;
}

describe("the sketch following what you play", () => {
    it("keeps the newest notes in view as the staff grows", () => {
        const { rerender } = mount(true, () => {}, "<score/>");
        const panel = sizePanel(1000, 400);
        // The staff redraws with the note just played; the panel goes to the end of it.
        fireEvent.scroll(panel, { target: { scrollTop: 600 } });
        panel.scrollTop = 0;
        rerender(
            <MemoryRouter>
                <ServicesProvider services={{ store: memoryStore(), midi: fakeMidi() }}>
                    <MidiProvider>
                        <ComposeStage
                            staffXml="<score>2</score>"
                            keyWindow={{ from: 48, to: 72 }}
                            controls={<button type="button">controls-slot</button>}
                            stageRef={createRef<HTMLElement>()}
                            fullscreen
                            onExitFullscreen={() => {}}
                        />
                    </MidiProvider>
                </ServicesProvider>
            </MemoryRouter>,
        );
        expect(panel.scrollTop).toBe(1000);
    });

    it("leaves you where you are once you scroll back to look at something", () => {
        const { rerender } = mount(true, () => {}, "<score/>");
        const panel = sizePanel(1000, 400);
        // Scrolled well away from the end: the panel must not yank you back.
        fireEvent.scroll(panel, { target: { scrollTop: 0 } });
        rerender(
            <MemoryRouter>
                <ServicesProvider services={{ store: memoryStore(), midi: fakeMidi() }}>
                    <MidiProvider>
                        <ComposeStage
                            staffXml="<score>2</score>"
                            keyWindow={{ from: 48, to: 72 }}
                            controls={<button type="button">controls-slot</button>}
                            stageRef={createRef<HTMLElement>()}
                            fullscreen
                            onExitFullscreen={() => {}}
                        />
                    </MidiProvider>
                </ServicesProvider>
            </MemoryRouter>,
        );
        expect(panel.scrollTop).toBe(0);
    });

    it("is a scroll panel outside full screen too, where you can also record", () => {
        // Playing without pressing Count in records just the same, and an unbounded staff
        // would push the controls off the page.
        mount(false, () => {}, "<score/>");
        const panel = screen.getByTestId("staff").parentElement;
        expect(panel?.className).toContain("overflow-y-auto");
    });
});
