// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { testMasteryStore } from "../testing/stores";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import { browserStore } from "../adapters/browserStore";
import { domXmlCodec } from "../adapters/domXmlCodec";
import { makeAssignment } from "../../core/assignment";
import { createAssignmentsStore } from "../stores/assignmentsStore";
import { buildScore, loadBundledScores, saveUserScore } from "../lib/catalog";

import AssignmentsRoute from "./assignments";
import Library from "./library";

// Bundled scores are keyed by their content-fingerprint id, so look one up by title.
const bundledId = (titleFragment: string): string =>
    loadBundledScores().find((score) => score.title.toLowerCase().includes(titleFragment))?.id ??
    "";

const USER_XML = `<?xml version="1.0"?><score-partwise><work><work-title>My Tune</work-title></work><part id="P1"><measure number="1"><note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration></note></measure></part></score-partwise>`;

// A single unbreakable word wider than a phone so a row that fails to truncate would
// push the whole page — and the fixed bottom nav — past the viewport edge.
const LONG_TITLE = "Supercalifragilisticexpialidociousandthensomemoreletters";
const LONG_TITLE_XML = `<?xml version="1.0"?><score-partwise><work><work-title>${LONG_TITLE}</work-title></work><part id="P1"><measure number="1"><note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration></note></measure></part></score-partwise>`;

afterEach(() => {
    cleanup();
    localStorage.clear();
});

// Renders in the browser project so the catalogue glob and DOMParser-based grading
// run as they do in the app; the song manifest fetch 404s here, leaving the bundled
// exercises, which is what these assertions cover.
function renderLibrary() {
    return render(
        <MemoryRouter>
            <Library />
        </MemoryRouter>,
    );
}

describe("Library", () => {
    it("lists bundled scores and links each to its play page", async () => {
        renderLibrary();
        const ode = await screen.findByText("Ode to Joy");
        expect(ode.closest("a")?.getAttribute("href")).toContain(
            `/play/${bundledId("ode to joy")}`,
        );
    });

    it("filters the list by the search box", async () => {
        renderLibrary();
        await screen.findByText("Ode to Joy");
        fireEvent.change(screen.getByRole("searchbox"), { target: { value: "no-such-piece" } });
        expect(await screen.findByText("No scores match your search.")).toBeTruthy();
    });

    it("offers a multi-select grade filter", async () => {
        renderLibrary();
        await screen.findByText("Ode to Joy");
        // Grade chips 1–8 narrow the catalogue by difficulty.
        const one = screen.getByLabelText("Grade 1");
        const two = screen.getByLabelText("Grade 8");
        expect(one).toBeTruthy();
        expect(two).toBeTruthy();
        // Each chip is an independent toggle, so several grades can be lit at once.
        fireEvent.click(one);
        fireEvent.click(two);
        expect(one.getAttribute("aria-pressed")).toBe("true");
        expect(two.getAttribute("aria-pressed")).toBe("true");
        // Clicking a lit chip clears just that grade.
        fireEvent.click(one);
        expect(one.getAttribute("aria-pressed")).toBe("false");
        expect(two.getAttribute("aria-pressed")).toBe("true");
    });

    it("stars and unstars a piece", async () => {
        renderLibrary();
        await screen.findByText("Ode to Joy");
        const star = screen.getAllByLabelText("Add to favorites")[0];
        if (!star) {
            throw new Error("no favorite control");
        }
        fireEvent.click(star);
        expect(await screen.findByLabelText("Remove from favorites")).toBeTruthy();
    });

    it("removes an imported score only after the delete is confirmed", async () => {
        saveUserScore(browserStore, buildScore(domXmlCodec, USER_XML, []));
        renderLibrary();
        expect(await screen.findByText("My Tune")).toBeTruthy();
        // The first click only arms the confirm — the unrecoverable delete shouldn't
        // fire on a single misclick.
        fireEvent.click(screen.getByLabelText("Remove"));
        expect(screen.getByText("My Tune")).toBeTruthy();
        fireEvent.click(screen.getByRole("button", { name: "Remove?" }));
        await waitFor(() => expect(screen.queryByText("My Tune")).toBeNull());
    });

    it("warns that a score is used by an assignment, deletes anyway, and the step goes missing", async () => {
        const score = buildScore(domXmlCodec, USER_XML, []);
        saveUserScore(browserStore, score);
        createAssignmentsStore(browserStore).save(
            makeAssignment({ id: "set", name: "Set", items: [{ id: score.id }] }),
        );
        const view = renderLibrary();
        expect(await screen.findByText("My Tune")).toBeTruthy();
        fireEvent.click(screen.getByLabelText("Remove"));
        // The armed confirm names the blast radius instead of a bare "Remove?".
        fireEvent.click(screen.getByRole("button", { name: "Used by 1 assignment — remove?" }));
        await waitFor(() => expect(screen.queryByText("My Tune")).toBeNull());
        view.unmount();
        // The assignment survives the delete; its step now reads as missing.
        render(
            <MemoryRouter>
                <AssignmentsRoute />
            </MemoryRouter>,
        );
        expect(await screen.findByText("Set")).toBeTruthy();
        expect(await screen.findByText("No longer on this device")).toBeTruthy();
    });

    it("gives a long title the shrink-and-truncate contract so it can't widen the row", async () => {
        saveUserScore(browserStore, buildScore(domXmlCodec, LONG_TITLE_XML, []));
        renderLibrary();
        const title = await screen.findByText(LONG_TITLE);
        // The title clips with an ellipsis…
        expect(title.className).toContain("truncate");
        // …which only takes effect if every flex ancestor up to the row link is allowed
        // to shrink below its content. Without min-w-0 on the link, an unbreakable title
        // pushes the row — and the fixed bottom nav — past the viewport edge.
        const titleBlock = title.parentElement as HTMLElement;
        expect(titleBlock.className).toContain("min-w-0");
        const row = title.closest("a") as HTMLElement;
        expect(row.className).toContain("min-w-0");
        expect(row.className).toContain("flex-1");
    });

    it("filters to only the pieces due for review", async () => {
        // Ode to Joy is overdue; Twinkle has no mastery, so it isn't due.
        testMasteryStore.save(bundledId("ode to joy"), {
            bestScore: 90,
            learned: true,
            backlog: false,
            intervalDays: 5,
            reviewAt: Date.now() - 86_400_000,
            updatedAt: 0,
        });
        renderLibrary();
        expect(await screen.findByText("Twinkle, Twinkle, Little Star")).toBeTruthy();

        fireEvent.click(screen.getByRole("button", { name: /due now/i }));
        expect(screen.getByText("Ode to Joy")).toBeTruthy();
        await waitFor(() => expect(screen.queryByText("Twinkle, Twinkle, Little Star")).toBeNull());
    });
});
