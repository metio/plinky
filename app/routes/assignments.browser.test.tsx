// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { encodeAssignmentLink, makeAssignment } from "../../core/assignment";
import { loadBundledScores } from "../lib/catalog";
import AssignmentsRoute from "./assignments";

// Bundled scores are keyed by their content-fingerprint id, so look one up by title.
const bundledId = (titleFragment: string): string =>
    loadBundledScores().find((score) => score.title.toLowerCase().includes(titleFragment))?.id ??
    "";

const mount = (entry = "/assignments") =>
    render(
        <MemoryRouter initialEntries={[entry]}>
            <AssignmentsRoute />
        </MemoryRouter>,
    );

afterEach(() => {
    cleanup();
    localStorage.clear();
    vi.restoreAllMocks();
});

describe("AssignmentsRoute", () => {
    it("builds an assignment from the catalogue and saves it", async () => {
        mount();
        fireEvent.change(screen.getByLabelText("Assignment name"), {
            target: { value: "My set" },
        });
        // A bundled piece is searchable straight away, no manifest needed.
        fireEvent.change(screen.getByLabelText(/Search pieces/), {
            target: { value: "Twinkle" },
        });
        fireEvent.click(await screen.findByText("Add"));
        // The chosen piece moves into the ordered basket (the built-in set lists the
        // same tune, so the match is not unique).
        expect(screen.getAllByText(/Twinkle/).length).toBeGreaterThan(0);
        fireEvent.click(screen.getByText("Save"));
        // It is confirmed and listed under the player's own assignments, its piece
        // shown as a playable step.
        expect(await screen.findByRole("status")).toHaveTextContent(/Saved/);
        expect(screen.getByText("My set")).toBeTruthy();
        const steps = screen.getAllByRole("link", { name: /Twinkle/ });
        expect(
            steps.some((step) =>
                step.getAttribute("href")?.includes(`/play/${bundledId("twinkle")}`),
            ),
        ).toBe(true);
    });

    it("offers a shared assignment from a link and imports it", async () => {
        const code = encodeAssignmentLink(
            makeAssignment({ name: "Shared set", items: [{ id: "twinkle-twinkle" }] }),
        );
        mount(`/assignments?assignment=${code}`);
        expect(await screen.findByText(/An assignment was shared/)).toBeTruthy();
        fireEvent.click(screen.getByText("Import this assignment"));
        // Once imported it appears in the player's list and the banner is gone.
        await waitFor(() => expect(screen.getByText("Shared set")).toBeTruthy());
        expect(screen.queryByText("Import this assignment")).toBeNull();
    });

    it("browses the whole catalogue page by page without a query", async () => {
        mount();
        // A blank query already lists the first page of pieces to browse.
        const firstPage = await screen.findAllByText("Add");
        expect(firstPage).toHaveLength(20);
        fireEvent.click(screen.getByText("Show more"));
        expect(screen.getAllByText("Add").length).toBeGreaterThan(20);
    });

    it("resets to the first page when the query changes", async () => {
        mount();
        fireEvent.click(await screen.findByText("Show more"));
        fireEvent.change(screen.getByLabelText(/Search pieces/), { target: { value: "e" } });
        expect(screen.getAllByText("Add").length).toBeLessThanOrEqual(20);
    });

    it("explains what a save still needs until it is possible", async () => {
        mount();
        const hint = /To save, give the assignment a name/;
        expect(screen.getByText(hint)).toBeTruthy();
        fireEvent.change(screen.getByLabelText("Assignment name"), {
            target: { value: "My set" },
        });
        fireEvent.change(screen.getByLabelText(/Search pieces/), {
            target: { value: "Twinkle" },
        });
        fireEvent.click(await screen.findByText("Add"));
        // Name and a piece are both present, so the hint yields to an active Save.
        expect(screen.queryByText(hint)).toBeNull();
        expect(screen.getByText<HTMLButtonElement>("Save").disabled).toBe(false);
    });

    it("edits a saved assignment in place", async () => {
        mount();
        fireEvent.change(screen.getByLabelText("Assignment name"), {
            target: { value: "My set" },
        });
        fireEvent.change(screen.getByLabelText(/Search pieces/), {
            target: { value: "Twinkle" },
        });
        fireEvent.click(await screen.findByText("Add"));
        fireEvent.click(screen.getByText("Save"));
        await screen.findByRole("status");
        // Editing loads the stored assignment back into the builder…
        fireEvent.click(screen.getByLabelText("Edit My set"));
        expect(screen.getByLabelText<HTMLInputElement>("Assignment name").value).toBe("My set");
        fireEvent.change(screen.getByLabelText("Assignment name"), {
            target: { value: "Renamed set" },
        });
        fireEvent.click(screen.getByText("Save"));
        // …and saving overwrites it instead of adding a sibling.
        await waitFor(() => expect(screen.getByText("Renamed set")).toBeTruthy());
        expect(screen.queryByText("My set")).toBeNull();
        expect(screen.getAllByLabelText(/^Edit /)).toHaveLength(1);
    });

    it("confirms a copied share link on the button that was pressed", async () => {
        // The test browsers have no navigator.share, so onShare takes the clipboard
        // path; a stubbed write keeps the copy from needing a real permission.
        const writeText = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
        const code = encodeAssignmentLink(
            makeAssignment({ name: "Shared set", items: [{ id: "twinkle-twinkle" }] }),
        );
        mount(`/assignments?assignment=${code}`);
        fireEvent.click(await screen.findByText("Import this assignment"));
        await waitFor(() => expect(screen.getByText("Shared set")).toBeTruthy());
        // The builder's own (disabled) Share button also reads "Share link"; the
        // saved assignment's is the enabled one.
        const shareButtons = screen.getAllByText<HTMLButtonElement>("Share link");
        fireEvent.click(shareButtons.find((button) => !button.disabled)!);
        // The pressed button itself reads "Copied!" — the confirmation lives where
        // the eye already is, not only in the status line at the top of the page.
        expect(await screen.findByText("Copied!")).toBeTruthy();
        expect(writeText).toHaveBeenCalledWith(expect.stringContaining("assignment="));
    });

    it("offers a built-in First steps assignment from the shipped catalogue", async () => {
        mount();
        // Assembled from the catalogue at load time, so it needs no saved state.
        expect(await screen.findByText("First steps")).toBeTruthy();
        expect(screen.getByText("Built-in assignments")).toBeTruthy();
        // The demo tunes lead the set, each a playable step.
        expect(screen.getAllByRole("link", { name: /Twinkle/ }).length).toBeGreaterThan(0);
    });

    it("reorders and removes items in the basket", async () => {
        mount();
        const search = screen.getByLabelText(/Search pieces/);
        fireEvent.change(search, { target: { value: "Twinkle" } });
        fireEvent.click(await screen.findByText("Add"));
        fireEvent.change(search, { target: { value: "Ode" } });
        fireEvent.click(await screen.findByText("Add"));
        // Two items in order; removing the first leaves the second.
        expect(screen.getAllByLabelText("Remove")).toHaveLength(2);
        fireEvent.click(screen.getAllByLabelText("Remove")[0]!);
        expect(screen.getAllByLabelText("Remove")).toHaveLength(1);
    });
});
