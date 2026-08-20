// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import { cleanup, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { PracticeLog, PracticeSession } from "../../../core/practiceSession";
import { memoryStore } from "../../adapters/memoryStore";
import { m } from "../../paraglide/messages.js";
import { createPracticeLogStore } from "../../stores/practiceLogStore";
import { renderWithServices } from "../../testing/renderWithServices";
import { PracticeBalance } from "./practiceBalance";

afterEach(cleanup);

const NOW = Date.UTC(2026, 5, 23, 12);
const DAY = 86_400_000;

const session = (daysAgo: number, minutes: number, pieces: string[]): PracticeSession => ({
    start: NOW - daysAgo * DAY,
    end: NOW - daysAgo * DAY + minutes * 60_000,
    activeMs: minutes * 60_000,
    notes: 0,
    pieces,
    manual: false,
    mood: null,
    label: "",
});

function mount(log: PracticeLog) {
    const kv = memoryStore();
    kv.set("plinky:practice-log", JSON.stringify(log));
    const practiceLog = createPracticeLogStore(kv);
    return renderWithServices(<PracticeBalance now={NOW} pieceTitle={(id) => `Piece ${id}`} />, {
        store: kv,
        practiceLog,
    });
}

describe("PracticeBalance", () => {
    it("lists the pieces that got the time, most-practised first", () => {
        mount([session(0, 10, ["bach"]), session(1, 40, ["satie"]), session(2, 20, ["bach"])]);
        const rows = screen.getAllByRole("listitem").map((row) => row.textContent ?? "");
        expect(rows[0]).toContain("Piece satie");
        expect(rows[1]).toContain("Piece bach");
        expect(rows[0]).toContain(m.practice_m({ minutes: 40 }));
        expect(rows[1]).toContain(m.practice_m({ minutes: 30 }));
    });

    it("says how long ago each piece was last touched", () => {
        // The whole reason the panel exists: a piece drifts out of a repertoire by
        // nobody deciding anything, and the gap is what makes that visible.
        mount([session(0, 10, ["bach"]), session(19, 10, ["clementi"])]);
        expect(screen.getByText(m.balance_last_today())).toBeTruthy();
        expect(screen.getByText(m.balance_last_other({ days: 19 }))).toBeTruthy();
    });

    it("says one day in the singular", () => {
        mount([session(1, 10, ["bach"])]);
        expect(screen.getByText(m.balance_last_one({ days: 1 }))).toBeTruthy();
    });

    it("shows nothing at all when no session named a piece", () => {
        // Free play and the trainers log minutes with no catalogue id. A heading over an
        // empty list would read as a reproach for a repertoire nobody has started.
        const { container } = mount([session(0, 30, [])]);
        expect(container.textContent).toBe("");
    });
});
