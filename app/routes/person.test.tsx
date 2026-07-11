// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { cleanup, screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import { server } from "../test-setup.node";
import { renderWithServices } from "../testing/renderWithServices";
import PersonPage from "./person";

afterEach(cleanup);

function pageAt(slug: string) {
    return (
        <MemoryRouter initialEntries={[`/en/person/${slug}`]}>
            <Routes>
                <Route path="/:locale/person/:slug" element={<PersonPage />} />
            </Routes>
        </MemoryRouter>
    );
}

// The manifest the page groups: two Bach spellings that must land on one page,
// plus an unrelated composer that must not.
const MANIFEST = [
    {
        id: "s1",
        title: "Menuet in G",
        composer: "J. S. Bach",
        grade: 2,
        license: "CC0-1.0",
        source: "mutopia",
        tempo: 90,
        beatsPerBar: 3,
    },
    {
        id: "s2",
        title: "Air on the G String",
        composer: "Johann Sebastian Bach (1685 - 1750)",
        grade: 4,
        license: "CC0-1.0",
        source: "pdmx",
        tempo: 60,
        beatsPerBar: 4,
    },
    {
        id: "s3",
        title: "Gymnopédie No. 1",
        composer: "Erik Satie",
        grade: 3,
        license: "CC0-1.0",
        source: "pdmx",
        tempo: 70,
        beatsPerBar: 3,
    },
];

describe("PersonPage", () => {
    it("gathers a composer's pieces across spelling variants, easiest first", async () => {
        server.use(http.get("*/songs/manifest.json", () => HttpResponse.json(MANIFEST)));
        renderWithServices(pageAt("johann-sebastian-bach"));
        expect(await screen.findByRole("heading", { name: "Johann Sebastian Bach" })).toBeTruthy();
        const links = screen.getAllByRole("link", { name: /Menuet|Air/ });
        expect(links.map((link) => link.textContent)).toEqual([
            expect.stringContaining("Menuet in G"),
            expect.stringContaining("Air on the G String"),
        ]);
        expect(links[0]?.getAttribute("href")).toContain("/play/s1");
        expect(screen.queryByText(/Gymnopédie/)).toBeNull();
    });

    it("says so when the slug matches nobody", async () => {
        server.use(http.get("*/songs/manifest.json", () => HttpResponse.json(MANIFEST)));
        renderWithServices(pageAt("nobody-here"));
        expect(await screen.findByText("Nobody by that name in the catalogue yet.")).toBeTruthy();
    });
});
