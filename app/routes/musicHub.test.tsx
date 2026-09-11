// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import { cleanup, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { pageTitle } from "../../core/site";
import { memoryStore } from "../adapters/memoryStore";
import { m } from "../paraglide/messages.js";
import type { ExerciseSource } from "../stores/exerciseSource";
import type { SongSource } from "../stores/songSource";
import { renderWithServices } from "../testing/renderWithServices";
import MusicHubRoute, { shelfFor, shelfHeading, shelfIntro, shelfTitle } from "./musicHub";

const WORK = { id: "czerny-op-821", name: "Czerny — 160 eight-bar exercises, op. 821", items: [] };

describe("a collection shelf's title", () => {
    it("is unknown while the works have not arrived, and the address stands in for it", () => {
        const shelf = shelfFor({ collection: WORK.id });
        expect(shelf).not.toBeNull();
        if (shelf === null) {
            return;
        }
        // No title and no line under it: nothing is written into the head until the
        // name is known, so the document the edge served keeps its own.
        expect(shelfTitle(shelf)).toBeNull();
        expect(shelfIntro(shelf)).toBeNull();
        expect(shelfHeading(shelf)).toBe(WORK.id);
    });

    it("is the work's own name once the works are known", () => {
        const shelf = shelfFor({ collection: WORK.id }, [WORK]);
        expect(shelf).not.toBeNull();
        if (shelf === null) {
            return;
        }
        expect(shelfTitle(shelf)).toBe(WORK.name);
        expect(shelfHeading(shelf)).toBe(WORK.name);
        expect(shelfIntro(shelf)).toBe(m.hub_collection_intro({ name: WORK.name }));
    });

    it("answers no shelf for an address the known works do not name", () => {
        expect(shelfFor({ collection: "nonsense" }, [WORK])).toBeNull();
    });

    it("leaves a grade and an era titled as before", () => {
        const grade = shelfFor({ grade: "3" });
        const era = shelfFor({ era: "baroque" });
        expect(grade && shelfTitle(grade)).toBe(m.hub_grade_title({ grade: 3 }));
        expect(grade && shelfHeading(grade)).toBe(m.hub_grade_title({ grade: 3 }));
        expect(era && shelfTitle(era)).toBe(m.hub_era_title_baroque());
    });
});

// The head as the edge serves it for this shelf: the work's name in the title, the
// social cards and the breadcrumb trail's last crumb.
const SERVED_TITLE = pageTitle(WORK.name);
const SERVED_TRAIL = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [{ "@type": "ListItem", position: 3, name: WORK.name }],
});

function served() {
    document.title = SERVED_TITLE;
    const og = document.createElement("meta");
    og.setAttribute("property", "og:title");
    og.setAttribute("content", WORK.name);
    const trail = document.createElement("script");
    trail.setAttribute("type", "application/ld+json");
    trail.textContent = SERVED_TRAIL;
    document.head.append(og, trail);
}

const ogTitle = () =>
    document.head.querySelector('meta[property="og:title"]')?.getAttribute("content");
const trail = () =>
    [...document.head.querySelectorAll('script[type="application/ld+json"]')]
        .map((tag) => tag.textContent ?? "")
        .find((text) => text.includes('"BreadcrumbList"'));

function mount(builtins: () => Promise<(typeof WORK)[] | null>) {
    const songs = { manifest: () => Promise.resolve([]), builtins } as unknown as SongSource;
    const exercises = { manifest: () => Promise.resolve([]) } as unknown as ExerciseSource;
    return renderWithServices(
        <MemoryRouter initialEntries={[`/en/music/collection/${WORK.id}/`]}>
            <Routes>
                <Route path=":locale">
                    <Route path="music/collection/:collection" element={<MusicHubRoute />} />
                </Route>
            </Routes>
        </MemoryRouter>,
        { store: memoryStore(), songs, exercises },
    );
}

beforeEach(served);
afterEach(() => {
    cleanup();
    document.head.innerHTML = "";
    document.title = "";
});

describe("a collection shelf's page", () => {
    it("heads itself with the address and leaves the served head alone while loading", async () => {
        mount(() => new Promise(() => {}));
        expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(WORK.id);
        // Let every effect run: none of them may have written over the served head.
        await waitFor(() => expect(document.title).toBe(SERVED_TITLE));
        expect(ogTitle()).toBe(WORK.name);
        expect(trail()).toBe(SERVED_TRAIL);
    });

    it("heads itself with the work's name once the works arrive", async () => {
        mount(() => Promise.resolve([WORK]));
        await waitFor(() =>
            expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(WORK.name),
        );
        expect(document.title).toBe(pageTitle(WORK.name));
        expect(ogTitle()).toBe(WORK.name);
        expect(trail()).toContain(WORK.name);
    });

    it("keeps the served head when the works cannot be fetched", async () => {
        mount(() => Promise.resolve(null));
        // The piece list gives up on the same fetch and says the shelf is empty: that is
        // the sign the page has settled.
        expect(await screen.findByText(m.hub_empty())).toBeTruthy();
        expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(WORK.id);
        expect(document.title).toBe(SERVED_TITLE);
        expect(ogTitle()).toBe(WORK.name);
        expect(trail()).toBe(SERVED_TRAIL);
    });
});
