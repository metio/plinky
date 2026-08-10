// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { todayKey } from "../../../core/daily";
import { shiftDay } from "../../../core/dateKey";
import { memoryStore } from "../../adapters/memoryStore";
import { m } from "../../paraglide/messages.js";
import { createPracticeLogStore, type PracticeLogStore } from "../../stores/practiceLogStore";
import { choose, chosen } from "../../testing/controls";
import { renderWithServices } from "../../testing/renderWithServices";
import { PracticeReport } from "./practiceReport";

afterEach(cleanup);

const MINUTE = 60_000;
const TODAY = todayKey(new Date());

// Seeding before the render rather than after keeps every write inside React's own
// commit: a store write from outside an event handler would leave the panel showing
// the snapshot it mounted with.
function mount(seed?: (store: PracticeLogStore) => void) {
    const kv = memoryStore();
    const practiceLog = createPracticeLogStore(kv);
    seed?.(practiceLog);
    const view = renderWithServices(<PracticeReport pieceTitle={(id) => `Piece ${id}`} />, {
        store: kv,
        practiceLog,
    });
    return { ...view, practiceLog };
}

describe("PracticeReport", () => {
    it("says nothing is recorded yet rather than showing empty totals", () => {
        mount();
        expect(screen.getByText(m.practice_empty())).toBeTruthy();
    });

    it("reports the time a run contributed", () => {
        mount((store) => store.record({ at: Date.now(), activeMs: 25 * MINUTE, notes: 120 }));
        expect(screen.getAllByText(m.practice_m({ minutes: 25 })).length).toBeGreaterThan(0);
        expect(screen.getByText("120")).toBeTruthy();
    });

    it("shows an hour-long sitting in hours and minutes", () => {
        mount((store) => store.record({ at: Date.now(), activeMs: 95 * MINUTE, notes: 300 }));
        expect(
            screen.getAllByText(m.practice_hm({ hours: 1, minutes: 35 })).length,
        ).toBeGreaterThan(0);
    });

    it("names the pieces a sitting touched, resolved to titles", () => {
        mount((store) =>
            store.record({ at: Date.now(), activeMs: 5 * MINUTE, notes: 20, pieceId: "alpha" }),
        );
        expect(screen.getByText("Piece alpha")).toBeTruthy();
    });

    it("marks a hand-logged sitting as such", () => {
        mount((store) =>
            store.addManual({ date: TODAY, minutes: 40, label: "scales at the piano" }),
        );
        // The summary line above the list also names how many were logged by hand, so
        // the row's own marker is asserted by matching more than one of them.
        expect(screen.getAllByText(m.practice_session_by_hand(), { exact: false })).toHaveLength(2);
        expect(screen.getByText("scales at the piano")).toBeTruthy();
    });

    it("narrows to the chosen period", () => {
        // Twenty days back: inside a month, outside a week.
        mount((store) => store.addManual({ date: shiftDay(TODAY, -20), minutes: 30 }));
        expect(chosen(m.practice_range_label)).toBe(m.practice_range_month());
        expect(screen.queryByText(m.practice_empty())).toBeNull();

        choose(m.practice_range_label, m.practice_range_week);
        expect(screen.getByText(m.practice_empty())).toBeTruthy();
    });

    it("adds time practised away from Plinky", () => {
        const { practiceLog } = mount();
        fireEvent.change(screen.getByLabelText(m.practice_add_minutes()), {
            target: { value: "45" },
        });
        fireEvent.click(screen.getByRole("button", { name: m.practice_add_action() }));
        expect(practiceLog.load()).toHaveLength(1);
        expect(practiceLog.load().at(0)?.manual).toBe(true);
        expect(practiceLog.load().at(0)?.activeMs).toBe(45 * MINUTE);
    });

    it("annotates a sitting with how it went, and can clear it again", () => {
        const { practiceLog } = mount((store) => store.addManual({ date: TODAY, minutes: 20 }));
        // The picker is folded away until asked for — a row of moods per sitting would
        // make the log louder than the practice it records.
        fireEvent.click(screen.getByRole("button", { name: m.practice_mood() }));
        choose(m.practice_mood, m.practice_mood_good);
        expect(practiceLog.load().at(0)?.mood).toBe("good");
        choose(m.practice_mood, m.practice_mood_none);
        expect(practiceLog.load().at(0)?.mood).toBeNull();
    });

    it("removes a sitting the player did not mean to record", () => {
        const { practiceLog } = mount((store) => store.addManual({ date: TODAY, minutes: 20 }));
        fireEvent.click(screen.getByRole("button", { name: m.practice_remove() }));
        expect(practiceLog.load()).toEqual([]);
    });
});
