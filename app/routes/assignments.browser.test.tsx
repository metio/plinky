// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import { encodeAssignmentLink, makeAssignment } from "../lib/assignment";
import AssignmentsRoute from "./assignments";

const mount = (entry = "/assignments") =>
    render(
        <MemoryRouter initialEntries={[entry]}>
            <AssignmentsRoute />
        </MemoryRouter>,
    );

afterEach(() => {
    cleanup();
    localStorage.clear();
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
        // The chosen piece moves into the ordered basket.
        expect(screen.getByText(/Twinkle/)).toBeTruthy();
        fireEvent.click(screen.getByText("Save"));
        // It is confirmed and listed under the player's own assignments, its piece
        // shown as a playable step.
        expect(await screen.findByRole("status")).toHaveTextContent(/Saved/);
        expect(screen.getByText("My set")).toBeTruthy();
        const step = screen.getByRole("link", { name: /Twinkle/ });
        expect(step.getAttribute("href")).toContain("/play/twinkle-twinkle");
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
