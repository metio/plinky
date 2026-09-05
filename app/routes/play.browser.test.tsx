// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { reveal } from "../testing/controls";
import { Link, MemoryRouter, Route as RouterRoute, Routes, useParams } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import { MidiProvider } from "../contexts/midi";
import { fakeMidi } from "../adapters/fakeMidi";
import { ServicesProvider } from "../contexts/services";
import { loadBundledScores } from "../lib/catalog";
import { httpFetcher } from "../adapters/httpFetcher";
import Play from "./play";
import type { Route } from "./+types/play";
import { m } from "../paraglide/messages.js";

// Bundled scores are keyed by their content-fingerprint id, so look one up by title.
// The browser context arrives with MIDI pre-granted; without a fake seam the
// provider would silently open a REAL Web MIDI connection under every test.
const midiFake = { midi: fakeMidi() };

const bundledId = (titleFragment: string): string =>
    loadBundledScores().find((score) => score.title.toLowerCase().includes(titleFragment))?.id ??
    "";

afterEach(() => {
    cleanup();
    localStorage.clear();
});

function renderPlay(scoreId: string) {
    const props = { params: { scoreId } } as unknown as Route.ComponentProps;
    return render(
        <MemoryRouter>
            <ServicesProvider services={midiFake}>
                <MidiProvider>
                    <Play {...props} />
                </MidiProvider>
            </ServicesProvider>
        </MemoryRouter>,
    );
}

describe("Play", () => {
    it("opens the next piece clean of what the address asked for the last one", async () => {
        // One route serves every piece and moving between them re-renders it rather than
        // remounting: a transposition asked for on one piece must not carry to the next.
        // The route is driven the way the app drives it: one Play under a :scoreId
        // segment, and a link to the next piece with a plain address.
        const PlayAt = () => {
            const { scoreId = "" } = useParams();
            const props = { params: { scoreId } } as unknown as Route.ComponentProps;
            return <Play {...props} />;
        };
        render(
            <MemoryRouter initialEntries={[`/en/play/${bundledId("ode to joy")}/?transpose=2`]}>
                <ServicesProvider services={midiFake}>
                    <MidiProvider>
                        <Link to={`/en/play/${bundledId("twinkle")}/`}>next piece</Link>
                        <Routes>
                            <RouterRoute path="/en/play/:scoreId/" element={<PlayAt />} />
                        </Routes>
                    </MidiProvider>
                </ServicesProvider>
            </MemoryRouter>,
        );
        expect(await screen.findByText("Ode to Joy")).toBeTruthy();
        await waitFor(() => expect(document.querySelector("svg")).toBeTruthy(), { timeout: 30000 });
        expect(screen.getByText("+2 st")).toBeTruthy();

        fireEvent.click(screen.getByRole("link", { name: "next piece" }));
        expect(await screen.findByText(/twinkle/i)).toBeTruthy();
        await waitFor(() => expect(document.querySelector("svg")).toBeTruthy(), { timeout: 30000 });
        expect(screen.getByText("0 st")).toBeTruthy();
    });

    it("renders the requested bundled piece", async () => {
        renderPlay(bundledId("ode to joy"));
        expect(await screen.findByText("Ode to Joy")).toBeTruthy();
        await waitFor(() => expect(document.querySelector("svg")).toBeTruthy(), { timeout: 30000 });
    });

    it("reports a missing score", async () => {
        renderPlay("no-such-score");
        expect(await screen.findByText("That score isn't on this device.")).toBeTruthy();
    });

    it("offers a retry instead of 'not found' while the catalogue is unreachable", async () => {
        // The fetcher override rebuilds the song/exercise sources over it, so a
        // failing network is simulated at the injected seam.
        let offline = true;
        const flaky: typeof httpFetcher = (url, init) =>
            offline ? Promise.reject(new TypeError("offline")) : httpFetcher(url, init);
        const props = { params: { scoreId: "no-such-score" } } as unknown as Route.ComponentProps;
        render(
            <MemoryRouter>
                <ServicesProvider services={{ ...midiFake, fetcher: flaky }}>
                    <MidiProvider>
                        <Play {...props} />
                    </MidiProvider>
                </ServicesProvider>
            </MemoryRouter>,
        );
        // Unreachable is not "gone": the page must not claim the piece is absent.
        expect(await screen.findByText(/check your connection/)).toBeTruthy();
        expect(screen.queryByText("That score isn't on this device.")).toBeNull();
        // With the network back, the retry re-asks — and a genuinely unknown id
        // now gets the honest not-found answer.
        offline = false;
        fireEvent.click(screen.getByRole("button", { name: "Try again" }));
        expect(await screen.findByText("That score isn't on this device.")).toBeTruthy();
    });

    it("puts the score first, with what you can do to the piece one fold away", async () => {
        // Both folds are closed at rest, so a piece's page opens on the piece.
        //
        // Closed is asserted through the fold itself rather than by looking for what it
        // holds. The panel collapses to a zero-height grid row and marks its contents
        // inert — which is what takes them out of the tab order and the accessibility
        // tree — but the nodes stay in the DOM, so a query for a control inside a shut
        // fold still finds it and proves nothing about what a player can reach.
        renderPlay(bundledId("ode to joy"));
        const play = await screen.findByRole("button", { name: m.run_group_practice_title() });
        const sheet = screen.getByRole("button", { name: m.run_group_sheet_title() });
        for (const fold of [play, sheet]) {
            expect(fold.getAttribute("aria-expanded")).toBe("false");
            const panel = document.getElementById(fold.getAttribute("aria-controls") ?? "");
            expect(panel?.querySelector("[inert]")).toBeTruthy();
        }
    });

    it("opens onto everything that is about this piece and no other", async () => {
        renderPlay(bundledId("ode to joy"));
        await screen.findByRole("button", { name: m.run_group_practice_title() });
        reveal(m.run_group_practice_title);
        // Both cards are in the one fold: how the run behaves, and what you can put on
        // top of it.
        expect(screen.getByText(m.run_group_pace_title())).toBeTruthy();
        expect(screen.getByText(m.run_group_challenge_title())).toBeTruthy();
        expect(screen.getByRole("tablist", { name: m.run_pace_label() })).toBeTruthy();
        expect(screen.getByRole("switch", { name: m.sight_read() })).toBeTruthy();
        expect(screen.getByRole("switch", { name: m.race_ghost_toggle() })).toBeTruthy();
    });

    it("flips the fingering switch at once and says the sheet is catching up", async () => {
        // Redrawing a sheet takes long enough to notice, and doing it in the same beat as
        // the switch's own commit means the browser never paints the new position first —
        // the switch sits unmoved for the whole redraw, which reads as a press that missed
        // and invites a second press that undoes it. So the switch moves immediately and
        // the wait is named beside it.
        renderPlay(bundledId("ode to joy"));
        await screen.findByRole("button", { name: m.run_group_sheet_title() }, { timeout: 30000 });
        await waitFor(() => expect(document.querySelector("svg")).toBeTruthy(), { timeout: 30000 });
        reveal(m.run_group_sheet_title);
        const fingering = screen.getByRole("switch", { name: m.action_finger_numbers() });
        const before = fingering.getAttribute("aria-checked");
        fireEvent.click(fingering);
        // Both in the very next paint, with no waiting: the new position AND the wait.
        expect(fingering.getAttribute("aria-checked")).not.toBe(before);
        expect(screen.getByRole("status", { name: m.score_redrawing() })).toBeTruthy();
        // And it goes away by itself once the sheet has caught up.
        await waitFor(
            () => expect(screen.queryByRole("status", { name: m.score_redrawing() })).toBeNull(),
            { timeout: 30000 },
        );
    }, 90000);

    it("stands a staff in while the piece is still arriving", async () => {
        // Opening a piece is a megabyte of engraver, the catalogue and then the notation,
        // and on a slow device that is seconds of nothing on screen at all. The wait is
        // drawn as the thing being waited for, and it names which part of the wait it is.
        renderPlay(bundledId("ode to joy"));
        // Whichever half of the wait this render is in, one of the two stands there.
        await waitFor(() =>
            expect(
                screen.queryByText(m.score_loading_fetching()) ??
                    screen.queryByText(m.score_loading_engraving()),
            ).toBeTruthy(),
        );
        // And both are gone once the notation is up — a placeholder that outlives what it
        // stood in for is worse than none.
        await waitFor(() => expect(document.querySelector("svg#osmdSvgPage1")).toBeTruthy(), {
            timeout: 30000,
        });
        await waitFor(() => {
            expect(screen.queryByText(m.score_loading_fetching())).toBeNull();
            expect(screen.queryByText(m.score_loading_engraving())).toBeNull();
        });
    }, 90000);

    it("keeps the play surface free of MIDI-connect chrome", async () => {
        // Connecting a device is a one-time setup task that lives in Settings
        // (with a getting-started step pointing there); a playing surface never
        // grows a Connect button or the computer-keys disclosure.
        renderPlay(bundledId("twinkle"));
        await screen.findByRole("button", { name: "Practice" }, { timeout: 30000 });
        expect(screen.queryByRole("button", { name: "Connect MIDI" })).toBeNull();
        expect(screen.queryByText(/No piano\?/)).toBeNull();
    }, 90000);
});
