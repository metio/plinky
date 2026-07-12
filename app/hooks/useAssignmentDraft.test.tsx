// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
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
