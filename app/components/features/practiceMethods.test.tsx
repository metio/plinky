// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import { cleanup, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { type MethodId, METHODS, type PracticeMethod } from "../../../core/practiceMethods";
import type { AppServices } from "../../contexts/services";
import { m } from "../../paraglide/messages.js";
import { renderWithServices } from "../../testing/renderWithServices";
import { METHOD_NAME, MethodLeaf } from "./practiceMethods";

const method = (id: MethodId): PracticeMethod => {
    const found = METHODS.find((candidate) => candidate.id === id);
    if (!found) {
        throw new Error(`no method ${id}`);
    }
    return found;
};

const leaf = (id: MethodId) => (
    <MemoryRouter>
        <MethodLeaf id="leaf" method={method(id)} />
    </MemoryRouter>
);

const hrefs = () => screen.getAllByRole("link").map((link) => link.getAttribute("href") ?? "");

afterEach(cleanup);

describe("MethodLeaf", () => {
    it("is a region named by its method, saying how long a go at it takes", () => {
        renderWithServices(leaf("interleaving"));
        const region = screen.getByRole("region", { name: m.method_interleaving_name() });
        expect(region.id).toBe("leaf");
        expect(screen.getByText(m.methods_dose({ count: 15 }))).toBeTruthy();
    });

    it("leads with the reason and follows with what Plinky gives you", () => {
        renderWithServices(leaf("chunking"));
        // Somebody who does not know why looping two bars beats replaying the piece will
        // not reach for the loop, so the reason comes first and is not labelled.
        expect(screen.getByText(m.method_chunking_why())).toBeTruthy();
        expect(screen.getByText(`${m.methods_in_plinky()}:`)).toBeTruthy();
    });

    it("assembles the catalogue once, and not again when another method opens", async () => {
        const songs = { manifest: vi.fn(() => Promise.resolve([])) };
        const exercises = { manifest: vi.fn(() => Promise.resolve([])) };
        const view = renderWithServices(leaf("chunking"), {
            songs: songs as unknown as AppServices["songs"],
            exercises: exercises as unknown as AppServices["exercises"],
        });
        await waitFor(() => expect(screen.getAllByRole("link").length).toBeGreaterThan(0));
        view.rerender(leaf("slow"));
        await screen.findByRole("region", { name: m.method_slow_name() });
        expect(songs.manifest).toHaveBeenCalledTimes(1);
        expect(exercises.manifest).toHaveBeenCalledTimes(1);
    });

    it("localises the link it builds, so a static host has a document to serve", async () => {
        // A bare /play/<id> has no prerendered document: it resolves under `serve -s`,
        // which falls back to the shell, and 404s on the host that actually ships. Every
        // link here goes through localizedHref for the locale prefix AND the trailing
        // slash that matches <path>/index.html.
        for (const { id } of METHODS) {
            renderWithServices(leaf(id));
            await waitFor(() => expect(hrefs().length).toBeGreaterThan(0));
            for (const href of hrefs()) {
                expect(href).toMatch(/^\/en\//);
                expect(href.split("?")[0]).toMatch(/\/$/);
            }
            cleanup();
        }
    });

    it("opens the chord set straight away, needing no grade and no catalogue", async () => {
        renderWithServices(leaf("chords"));
        const link = await screen.findByRole("link", { name: m.methods_chords_open() });
        expect(link.getAttribute("href")).toContain("/play/chords-c-major");
    });

    it("sends the two methods that are not about one piece to the review queue", async () => {
        for (const id of ["interleaving", "spacing"] as const) {
            renderWithServices(leaf(id));
            const link = await screen.findByRole("link", { name: m.methods_review() });
            expect(link.getAttribute("href")).toContain("/review");
            cleanup();
        }
    });

    it("opens a piece with the method already set up on it", async () => {
        // The button IS the control, not a signpost to it: the address carries the method.
        // Hearing it first needs nothing in the address — the switch is on the surface.
        const expected: [MethodId, (href: string) => boolean][] = [
            ["chunking", (href) => href.includes("loop=1-4")],
            ["slow", (href) => href.includes("speed=0.6")],
            ["handsApart", (href) => href.includes("hands=left")],
            ["hearingFirst", (href) => !href.includes("?")],
        ];
        for (const [id, carries] of expected) {
            renderWithServices(leaf(id));
            const link = await screen.findByRole("link", { name: m.methods_try({ grade: 1 }) });
            const href = link.getAttribute("href") ?? "";
            expect(href).toContain("/play/");
            expect(carries(href)).toBe(true);
            cleanup();
        }
    });

    it("offers each piece-opening method its own piece rather than the same one every time", async () => {
        // Seeded by method id, so which piece each one offers is stable but they are not all
        // the same piece — on a shelf with only the bundled demos on it, at least two of the
        // four differ.
        const ids: MethodId[] = ["chunking", "slow", "handsApart", "hearingFirst"];
        renderWithServices(
            <MemoryRouter>
                {ids.map((id) => (
                    <MethodLeaf key={id} id={`leaf-${id}`} method={method(id)} />
                ))}
            </MemoryRouter>,
        );
        await waitFor(() => {
            const pieces = hrefs()
                .filter((href) => href.includes("/play/"))
                .map((href) => href.split("?")[0]);
            expect(pieces).toHaveLength(4);
            expect(new Set(pieces).size).toBeGreaterThan(1);
        });
    });

    it("names every method from the catalogue of messages", () => {
        for (const { id } of METHODS) {
            expect(METHOD_NAME[id]().length).toBeGreaterThan(0);
        }
    });
});
