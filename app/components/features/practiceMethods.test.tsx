// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import { cleanup, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { METHODS } from "../../../core/practiceMethods";
import type { AppServices } from "../../contexts/services";
import { m } from "../../paraglide/messages.js";
import { renderWithServices } from "../../testing/renderWithServices";
import { PracticeMethods } from "./practiceMethods";

const mount = () =>
    renderWithServices(
        <MemoryRouter>
            <PracticeMethods />
        </MemoryRouter>,
    );

afterEach(cleanup);

describe("PracticeMethods", () => {
    it("assembles the catalogue once for all six buttons", async () => {
        // Each button picks from the same catalogue; a hook per button would parse every
        // held score and map three thousand rows six times over on every home visit.
        const songs = { manifest: vi.fn(() => Promise.resolve([])) };
        const exercises = { manifest: vi.fn(() => Promise.resolve([])) };
        renderWithServices(
            <MemoryRouter>
                <PracticeMethods />
            </MemoryRouter>,
            {
                songs: songs as unknown as AppServices["songs"],
                exercises: exercises as unknown as AppServices["exercises"],
            },
        );
        await waitFor(() => {
            expect(screen.getAllByRole("link").length).toBeGreaterThanOrEqual(2);
        });
        expect(songs.manifest).toHaveBeenCalledTimes(1);
        expect(exercises.manifest).toHaveBeenCalledTimes(1);
    });

    it("names every method with its dose", () => {
        mount();
        expect(screen.getByRole("heading", { name: m.methods_title() })).toBeTruthy();
        expect(screen.getAllByRole("listitem")).toHaveLength(METHODS.length);
        expect(screen.getByText(m.method_chunking_name())).toBeTruthy();
        expect(screen.getByText(m.methods_dose({ count: 15 }))).toBeTruthy();
    });

    it("leads with the reason and follows with what Plinky gives you", () => {
        mount();
        // Somebody who does not know why looping two bars beats replaying the piece will
        // not reach for the loop, so the reason comes first and is not labelled.
        expect(screen.getByText(m.method_chunking_why())).toBeTruthy();
        expect(screen.getAllByText(`${m.methods_in_plinky()}:`).length).toBe(METHODS.length);
    });

    it("localises every link it builds, so a static host has a document to serve", async () => {
        // A bare /play/<id> has no prerendered document: it resolves under `serve -s`,
        // which falls back to the shell, and 404s on the host that actually ships. Every
        // link here goes through localizedHref for the locale prefix AND the trailing
        // slash that matches <path>/index.html.
        mount();
        await waitFor(() => {
            const hrefs = screen.getAllByRole("link").map((l) => l.getAttribute("href") ?? "");
            expect(hrefs.length).toBeGreaterThan(0);
            for (const href of hrefs) {
                expect(href).toMatch(/^\/en\//);
                expect(href.split("?")[0]).toMatch(/\/$/);
            }
        });
    });

    it("sends the two methods that are not about one piece to the review queue", async () => {
        mount();
        await waitFor(() => {
            const review = screen.getAllByRole("link", { name: m.methods_review() });
            expect(review).toHaveLength(2);
            for (const link of review) {
                expect(link.getAttribute("href")).toContain("/review");
            }
        });
    });

    it("opens a piece with the method already set up on it", async () => {
        mount();
        // The four methods that are about one piece each offer a piece, and the address
        // carries the method: the button IS the control, not a signpost to it.
        await waitFor(() => {
            const hrefs = screen
                .getAllByRole("link")
                .map((link) => link.getAttribute("href") ?? "")
                .filter((href) => href.includes("/play/"));
            expect(hrefs).toHaveLength(4);
            expect(hrefs.some((href) => href.includes("speed=0.6"))).toBe(true);
            expect(hrefs.some((href) => href.includes("hands=left"))).toBe(true);
            expect(hrefs.some((href) => href.includes("loop=1-4"))).toBe(true);
            // Hearing it first needs no set-up in the address — the switch is on the
            // surface the link opens.
            expect(hrefs.some((href) => !href.includes("?"))).toBe(true);
        });
    });

    it("offers each method its own piece rather than the same one six times", async () => {
        mount();
        await waitFor(() => {
            const pieces = screen
                .getAllByRole("link")
                .map((link) => link.getAttribute("href") ?? "")
                .filter((href) => href.includes("/play/"))
                .map((href) => href.split("?")[0]);
            expect(pieces).toHaveLength(4);
            // Seeded by method id, so which piece each one offers is stable but they are
            // not all the same piece — on a shelf with only the bundled demos on it, at
            // least two of the four differ.
            expect(new Set(pieces).size).toBeGreaterThan(1);
        });
    });
});
