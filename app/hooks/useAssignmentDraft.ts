// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useState } from "react";
import {
    type Assignment,
    type AssignmentItem,
    makeAssignment,
    newAssignmentId,
} from "../../core/assignment";
import { moveTo } from "../../core/reorder";

// How many picker rows show before "Show more".
export const PICKER_PAGE = 20;

// The builder's draft: the one assignment being assembled or edited. All the
// basket mechanics live here — adding, removing, reordering, per-step tempo and
// note — so the builder component only renders and the route only saves.
export function useAssignmentDraft() {
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [items, setItems] = useState<AssignmentItem[]>([]);
    const [query, setQueryState] = useState("");
    const [visible, setVisible] = useState(PICKER_PAGE);
    // The id of the saved assignment being edited, so saving overwrites it in
    // place instead of creating a sibling.
    const [editingId, setEditingId] = useState<string | null>(null);

    // A new search resets the pagination — page depth belongs to the old results.
    const setQuery = (value: string) => {
        setQueryState(value);
        setVisible(PICKER_PAGE);
    };
    const showMore = () => setVisible((count) => count + PICKER_PAGE);

    const addItem = (id: string) =>
        setItems((current) =>
            current.some((item) => item.id === id) ? current : [...current, { id }],
        );
    const removeItem = (index: number) =>
        setItems((current) => current.filter((_, i) => i !== index));
    const moveItem = (index: number, delta: number) =>
        setItems((current) => {
            const next = [...current];
            const target = index + delta;
            if (target < 0 || target >= next.length) {
                return current;
            }
            [next[index], next[target]] = [next[target]!, next[index]!];
            return next;
        });
    const reorder = (from: number, to: number) => setItems((current) => moveTo(current, from, to));
    const setItemTempo = (index: number, value: string) =>
        setItems((current) =>
            current.map((item, i) => {
                if (i !== index) {
                    return item;
                }
                const tempo = Number(value);
                const { tempo: _drop, ...rest } = item;
                return value && Number.isFinite(tempo) ? { ...rest, tempo } : rest;
            }),
        );
    const setItemNote = (index: number, value: string) =>
        setItems((current) =>
            current.map((item, i) => {
                if (i !== index) {
                    return item;
                }
                const { note: _drop, ...rest } = item;
                return value.trim() ? { ...rest, note: value } : rest;
            }),
        );

    // The draft as a saveable assignment. An edit keeps its id so the save lands
    // on the stored assignment even when the name changed; a new draft derives a
    // fresh id that avoids the ids already taken.
    const draft = (existingIds: string[]): Assignment =>
        makeAssignment({
            id: editingId ?? newAssignmentId(name, existingIds),
            name,
            description,
            items,
        });

    const reset = () => {
        setName("");
        setDescription("");
        setItems([]);
        setQueryState("");
        setEditingId(null);
    };

    const startEdit = (assignment: Assignment) => {
        setName(assignment.name);
        setDescription(assignment.description ?? "");
        setItems(assignment.items);
        setEditingId(assignment.id);
    };

    return {
        name,
        setName,
        description,
        setDescription,
        items,
        query,
        setQuery,
        visible,
        showMore,
        editingId,
        canSave: name.trim().length > 0 && items.length > 0,
        addItem,
        removeItem,
        moveItem,
        reorder,
        setItemTempo,
        setItemNote,
        draft,
        reset,
        startEdit,
    };
}

export type AssignmentDraft = ReturnType<typeof useAssignmentDraft>;
