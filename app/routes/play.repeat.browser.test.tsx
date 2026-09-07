// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fakeMidi, fakeMidiInput } from "../adapters/fakeMidi";
import { MidiProvider } from "../contexts/midi";
import { ServicesProvider } from "../contexts/services";
import Play from "./play";
import type { Route } from "./+types/play";

// The whole play page over a shipped study whose first three bars repeat, played from a
// fake instrument: every painter the page owns is in the loop, so what the score shows
// after the repeat sends the run back is asserted on the page a player sees.
const STUDY = "SNUXtYTTK1MM";
const C4 = 60;

afterEach(() => {
    cleanup();
    localStorage.clear();
});

const halos = () => document.querySelectorAll("svg rect.plinky-note-halo").length;

// The page as a player with an earlier take sees it: a ghost of that take races along the
// staff. It is stored the way the ghost store writes it, so the page finds it on its own.
function storeGhost(onsetsMs: number[]) {
    localStorage.setItem(`plinky:ghost:${STUDY}`, JSON.stringify(onsetsMs));
}

async function mountAndStart() {
    vi.spyOn(Element.prototype, "requestFullscreen").mockResolvedValue(undefined);
    const input = fakeMidiInput();
    const props = { params: { scoreId: STUDY } } as unknown as Route.ComponentProps;
    render(
        <MemoryRouter>
            <ServicesProvider
                services={{ midi: fakeMidi({ permission: "granted", inputs: [input] }) }}
            >
                <MidiProvider>
                    <Play {...props} />
                </MidiProvider>
            </ServicesProvider>
        </MemoryRouter>,
    );
    const practice = await screen.findByRole("button", { name: "Practice" }, { timeout: 30000 });
    await expect
        .poll(() => (practice as HTMLButtonElement).disabled, { timeout: 30000 })
        .toBe(false);
    fireEvent.click(practice);
    return input;
}

describe("Play over a repeated opening", () => {
    it("keeps the bars uncoloured when the ghost leaves them after the repeat", async () => {
        // The ghost is a little behind the player: it leaves the third bar only after the
        // repeat has sent the run back, which is the moment it used to paint that bar
        // green again.
        storeGhost([0, 700, 1400, 2100, 2800, 3500, 4200, 4900]);
        const input = await mountAndStart();
        const strike = () => {
            input.emit([0x90, C4, 90], performance.now());
            input.emit([0x80, C4, 0], performance.now() + 100);
        };
        strike();
        await waitFor(() => expect(halos()).toBe(1));
        await new Promise((r) => setTimeout(r, 300));
        strike();
        await waitFor(() => expect(halos()).toBe(2));
        await new Promise((r) => setTimeout(r, 300));
        strike();
        await waitFor(() => expect(halos()).toBe(0));
        // Long enough for the ghost to move off the third bar.
        await new Promise((r) => setTimeout(r, 1500));
        expect(halos()).toBe(0);
        expect(document.querySelectorAll("rect.plinky-ghost-mark").length).toBeLessThanOrEqual(1);
    });

    it("uncolours all three bars when the repeat sends the run back", async () => {
        vi.spyOn(Element.prototype, "requestFullscreen").mockResolvedValue(undefined);
        const input = fakeMidiInput();
        const props = { params: { scoreId: STUDY } } as unknown as Route.ComponentProps;
        render(
            <MemoryRouter>
                <ServicesProvider
                    services={{ midi: fakeMidi({ permission: "granted", inputs: [input] }) }}
                >
                    <MidiProvider>
                        <Play {...props} />
                    </MidiProvider>
                </ServicesProvider>
            </MemoryRouter>,
        );
        const practice = await screen.findByRole(
            "button",
            { name: "Practice" },
            { timeout: 30000 },
        );
        await expect
            .poll(() => (practice as HTMLButtonElement).disabled, { timeout: 30000 })
            .toBe(false);
        fireEvent.click(practice);

        // Each key is held across the page's reaction to it and released afterwards, the
        // way a hand plays: the third bar's release lands after the repeat has already
        // sent the run back.
        const play = async (expected: number) => {
            input.emit([0x90, C4, 90], performance.now());
            await waitFor(() => expect(halos()).toBe(expected));
            await new Promise((r) => setTimeout(r, 250));
            input.emit([0x80, C4, 0], performance.now());
            await new Promise((r) => setTimeout(r, 250));
            expect(halos()).toBe(expected);
        };
        // The first pass colours each bar as it is played.
        await play(1);
        await play(2);
        // The third bar closes the repeat: the run is sent back to bar 1, and the three
        // bars it plays again must read as unplayed — the third included.
        await play(0);
        // The second pass colours them again, one at a time.
        await play(1);
        await play(2);
        await play(3);
        // Bar 4 is new music and takes its colour where it is.
        await play(4);
    });
});
