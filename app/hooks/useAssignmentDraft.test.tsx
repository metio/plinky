// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { makeAssignment } from "../../core/assignment";
import { PICKER_PAGE, useAssignmentDraft } from "./useAssignmentDraft";

describe("useAssignmentDraft", () => {
    it("assembles a basket without duplicates and orders it", () => {
        const { result } = renderHook(() => useAssignmentDraft());

        act(() => {
            result.current.addItem("a");
            result.current.addItem("b");
            result.current.addItem("a");
        });
        expect(result.current.items.map((i) => i.id)).toEqual(["a", "b"]);

        act(() => result.current.moveItem(0, 1));
        expect(result.current.items.map((i) => i.id)).toEqual(["b", "a"]);
        // Moving past either end changes nothing.
        act(() => result.current.moveItem(1, 1));
        expect(result.current.items.map((i) => i.id)).toEqual(["b", "a"]);

        act(() => result.current.reorder(1, 0));
        expect(result.current.items.map((i) => i.id)).toEqual(["a", "b"]);
    });

    it("keeps tempo and note only while they hold a real value", () => {
        const { result } = renderHook(() => useAssignmentDraft());
        act(() => result.current.addItem("a"));

        act(() => result.current.setItemTempo(0, "90"));
        expect(result.current.items[0]).toEqual({ id: "a", tempo: 90 });
        act(() => result.current.setItemTempo(0, ""));
        expect(result.current.items[0]).toEqual({ id: "a" });

        act(() => result.current.setItemNote(0, "slowly"));
        expect(result.current.items[0]).toEqual({ id: "a", note: "slowly" });
        act(() => result.current.setItemNote(0, "   "));
        expect(result.current.items[0]).toEqual({ id: "a" });
    });

    it("requires a name and at least one step before it can save", () => {
        const { result } = renderHook(() => useAssignmentDraft());
        expect(result.current.canSave).toBe(false);
        act(() => result.current.setName("Week 1"));
        expect(result.current.canSave).toBe(false);
        act(() => result.current.addItem("a"));
        expect(result.current.canSave).toBe(true);
    });

    it("keeps the edited assignment's id and clears it on reset", () => {
        const { result } = renderHook(() => useAssignmentDraft());
        act(() =>
            result.current.startEdit(
                makeAssignment({
                    id: "week-1",
                    name: "Week 1",
                    description: "warmups",
                    items: [{ id: "a" }],
                }),
            ),
        );
        expect(result.current.editingId).toBe("week-1");
        expect(result.current.draft(["week-1"]).id).toBe("week-1");

        act(() => result.current.reset());
        expect(result.current.editingId).toBeNull();
        expect(result.current.items).toEqual([]);
    });

    it("resets the picker page on a new search and pages forward", () => {
        const { result } = renderHook(() => useAssignmentDraft());
        act(() => result.current.showMore());
        expect(result.current.visible).toBe(PICKER_PAGE * 2);
        act(() => result.current.setQuery("bach"));
        expect(result.current.visible).toBe(PICKER_PAGE);
    });
});

describe("the identity a draft carries", () => {
    // A counter rather than the ambient generator, so the test can name what each
    // draft was given. Built once per test and closed over: constructing it inside
    // the render callback would hand every render a counter starting at one, and the
    // hook would look like it never minted a second id.
    const counting = () => {
        let next = 0;
        return () => `origin-${++next}`;
    };

    it("gives a new draft an origin", () => {
        const newId = counting();
        const { result } = renderHook(() => useAssignmentDraft(newId));
        act(() => result.current.addItem("a"));

        expect(result.current.draft([]).origin).toBe("origin-1");
    });

    it("hands out the same origin however many times the draft is read", () => {
        // A teacher who shares a draft link and then saves it must hand out the
        // identity the save stores; minting per read would give the class one id and
        // the teacher another, and the reports would name an assignment nobody has.
        const newId = counting();
        const { result } = renderHook(() => useAssignmentDraft(newId));
        act(() => result.current.addItem("a"));

        const shared = result.current.draft([]);
        act(() => result.current.setName("Week 3"));
        const saved = result.current.draft([]);

        expect(saved.origin).toBe(shared.origin);
    });

    it("keeps an edited assignment's origin", () => {
        const newId = counting();
        const { result } = renderHook(() => useAssignmentDraft(newId));
        const existing = makeAssignment({
            id: "week-3",
            origin: "already-shared",
            name: "Week 3",
            items: [{ id: "a" }],
        });

        act(() => result.current.startEdit(existing));

        expect(result.current.draft([]).origin).toBe("already-shared");
    });

    it("gives the next draft a fresh origin", () => {
        const newId = counting();
        const { result } = renderHook(() => useAssignmentDraft(newId));
        act(() => result.current.addItem("a"));
        const first = result.current.draft([]).origin;

        act(() => result.current.reset());
        act(() => result.current.addItem("b"));

        expect(result.current.draft([]).origin).not.toBe(first);
    });

    it("gives an assignment saved without one an origin when it is edited", () => {
        const newId = counting();
        const { result } = renderHook(() => useAssignmentDraft(newId));
        const bare = makeAssignment({ id: "old", name: "Old", items: [{ id: "a" }] });
        expect(bare.origin).toBeUndefined();

        act(() => result.current.startEdit(bare));

        // Which number it draws does not matter; that it stops being anonymous does.
        expect(result.current.draft([]).origin).toMatch(/^origin-/);
    });
});
