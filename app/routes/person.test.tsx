// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
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

    it("lists a composer whose work here is all studies", async () => {
        // The piece count on this page is baked from the song AND exercise manifests, and
        // the page listed from the songs alone — so Ferdinand Beyer, whose whole presence
        // in the catalogue is three studies, got a page announcing three pieces and
        // showing none.
        server.use(
            http.get("*/songs/manifest.json", () => HttpResponse.json(MANIFEST)),
            http.get("*/exercises/manifest.json", () =>
                HttpResponse.json([
                    {
                        id: "x1",
                        title: "Beyer No. 8",
                        composer: "Ferdinand Beyer",
                        grade: 1,
                        cost: 0,
                        kind: "study",
                        license: "CC0-1.0",
                        tempo: 90,
                        beatsPerBar: 4,
                    },
                    // A study crediting nobody belongs to no page.
                    { id: "x2", title: "Anon study", grade: 1, cost: 0, kind: "study" },
                ]),
            ),
        );
        renderWithServices(pageAt("ferdinand-beyer"));
        expect(await screen.findByRole("heading", { name: "Ferdinand Beyer" })).toBeTruthy();
        const study = await screen.findByRole("link", { name: /Beyer No\. 8/ });
        expect(study.getAttribute("href")).toContain("/play/x1");
        expect(screen.queryByText(/Anon study/)).toBeNull();
    });

    it("says so when the slug matches nobody", async () => {
        server.use(http.get("*/songs/manifest.json", () => HttpResponse.json(MANIFEST)));
        renderWithServices(pageAt("nobody-here"));
        expect(await screen.findByText("Nobody by that name in the catalogue yet.")).toBeTruthy();
    });
});
