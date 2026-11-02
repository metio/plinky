// SPDX-FileCopyrightText: The Klimpi Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import { NEW_HOST } from "../../../core/oldDomain";
import { m } from "../../paraglide/messages.js";
import { MovedBanner } from "./movedBanner";

afterEach(cleanup);

const show = (offer: boolean) =>
    render(
        <MemoryRouter>
            <MovedBanner offer={offer} />
        </MemoryRouter>,
    );

describe("the notice on the old address", () => {
    it("says nothing at all where the move does not apply", () => {
        show(false);

        expect(screen.queryByRole("status")).toBeNull();
    });

    it("names where the app went", () => {
        show(true);

        expect(screen.getByRole("status").textContent).toContain(NEW_HOST);
    });

    // The crossing is the whole point of the notice: a backup on this side, a restore on
    // the other. Both links have to land on the page that does each, so the second one
    // names the new host and the same path rather than its home page.
    it("offers the backup here and the restore there", () => {
        show(true);

        const here = screen.getByRole("link", { name: m.moved_backup() });
        const path = here.getAttribute("href") ?? "";
        expect(path).toMatch(/\/settings\/$/);

        const there = screen.getByRole("link", { name: m.moved_new_home({ host: NEW_HOST }) });
        expect(there.getAttribute("href")).toBe(`https://${NEW_HOST}${path}`);
    });

    it("goes away when dismissed", () => {
        show(true);

        fireEvent.click(screen.getByRole("button", { name: m.action_dismiss() }));

        expect(screen.queryByRole("status")).toBeNull();
    });
});
