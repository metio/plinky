// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { cleanup, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { SECTIONS } from "../../../core/sectionBest";
import type { RunNote } from "../../../core/shareCard";
import { memoryStore } from "../../adapters/memoryStore";
import { m } from "../../paraglide/messages.js";
import { renderWithServices } from "../../testing/renderWithServices";
import { SectionBest } from "./sectionBest";

afterEach(cleanup);

const notes: RunNote[] = Array.from({ length: 24 }, (_, index) => ({
    targetMs: index * 500,
    playedMs: index * 500,
    wrongBefore: 0,
    staves: [0],
}));

// A run that stumbled, so it scores below a record of 100 — the shape the panel
// actually meets, since the record is merged before it renders and so is never
// lower than the run.
const stumbled: RunNote[] = Array.from({ length: 24 }, (_, index) => ({
    targetMs: index * 500,
    playedMs: index * 500 + (index % 3) * 260,
    wrongBefore: index % 2,
    staves: [0],
}));

const mount = (best?: number[], run: RunNote[] = notes) =>
    renderWithServices(<SectionBest scoreId="song" notes={run} tolerance={60} tempoScale={1} />, {
        store: memoryStore(best ? { "plinky:sectionbest:song": JSON.stringify(best) } : {}),
    });

describe("SectionBest", () => {
    it("shows nothing for a piece with no record yet", () => {
        const { container } = mount();

        expect(container.firstChild).toBeNull();
    });

    it("heads with the total of every section's best", () => {
        mount([60, 60, 60, 60, 60, 60]);

        expect(screen.getByText(m.section_best_heading({ total: 60 }))).toBeTruthy();
    });

    it("draws one bar per section", () => {
        mount([10, 20, 30, 40, 50, 60]);

        expect(screen.getAllByRole("listitem")).toHaveLength(SECTIONS);
    });

    it("says when this run set nothing new", () => {
        // A stumbling run against a spotless record: nothing to celebrate, and the
        // record is left standing rather than quietly redrawn as this run's.
        mount([100, 100, 100, 100, 100, 100], stumbled);

        expect(screen.getByText(m.section_best_none())).toBeTruthy();
    });

    it("says how many sections this run holds the record for", () => {
        // A clean run against a record it just set — which is what the panel sees,
        // the merge having already happened before it renders.
        mount([100, 100, 100, 100, 100, 100]);

        expect(
            screen.getByText(m.section_best_set({ count: SECTIONS, total: SECTIONS })),
        ).toBeTruthy();
    });
});
