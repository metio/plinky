// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { cleanup, fireEvent, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { m } from "../paraglide/messages.js";
import { renderWithServices } from "../testing/renderWithServices";
import TheoryRoute from "./theory";

afterEach(cleanup);

// The drawings in the lesson's example, counted where the engraver really draws. An svg
// with nothing in it still takes up its old size on the page, so an emptied drawing left
// behind is a blank gap above the new one rather than something harmless.
function drawings(): SVGElement[] {
    return [...document.querySelectorAll<SVGElement>("figure svg")];
}

describe("a theory lesson's example", () => {
    // One lesson's drawing is a property of the page and the engine, not of the browser
    // around them, and Gecko's OSMD tests already sit close to this project's timeout.
    it.skipIf(navigator.userAgent.includes("Firefox"))(
        "is drawn once when the reader moves to another lesson",
        async () => {
            renderWithServices(
                <MemoryRouter initialEntries={["/en/theory/major"]}>
                    <Routes>
                        <Route path=":locale">
                            <Route path="theory/:lesson" element={<TheoryRoute />} />
                        </Route>
                    </Routes>
                </MemoryRouter>,
            );
            await vi.waitFor(() => expect(drawings()).toHaveLength(1), { timeout: 10_000 });

            const index = screen.getByRole("navigation", { name: m.theory_index_label() });
            fireEvent.click(
                within(index).getByRole("link", { name: new RegExp(m.theory_minor_title()) }),
            );
            expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
                m.theory_minor_title(),
            );
            await vi.waitFor(
                () => expect(drawings().some((svg) => svg.querySelector("path"))).toBe(true),
                { timeout: 10_000 },
            );

            expect(drawings()).toHaveLength(1);
        },
    );
});
