// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import { cleanup, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router";
import { renderWithServices } from "../testing/renderWithServices";
import { m } from "../paraglide/messages.js";
import Teach from "./teach";

afterEach(cleanup);

const hrefFor = (name: string) =>
    screen.getByRole("link", { name: new RegExp(name, "i") }).getAttribute("href");

describe("Teach", () => {
    it("gathers both halves of setting work for somebody else", () => {
        renderWithServices(
            <MemoryRouter>
                <Teach />
            </MemoryRouter>,
        );
        expect(screen.getByRole("heading", { name: m.teach_title() })).toBeTruthy();
        // An assignment is an ordered path someone laid — a teacher's, or your own — so it
        // is a course of study rather than a shelf to browse.
        expect(hrefFor(m.home_assignments())).toBe("/en/assignments/");
        // And the other half of the loop, which reads the codes a student sends back. The
        // two used never to link to each other.
        expect(hrefFor(m.collect_title())).toBe("/en/collect/");
    });
});
