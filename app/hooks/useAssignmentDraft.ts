// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useState } from "react";
import {
    addItem as addToItems,
    type Assignment,
    type AssignmentItem,
    makeAssignment,
    moveItem as moveInItems,
    newAssignmentId,
    removeItem as removeFromItems,
    withItemNote,
    withItemTempo,
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

    const addItem = (id: string) => setItems((current) => addToItems(current, id));
    const removeItem = (index: number) => setItems((current) => removeFromItems(current, index));
    const moveItem = (index: number, delta: number) =>
        setItems((current) => moveInItems(current, index, delta));
    const reorder = (from: number, to: number) => setItems((current) => moveTo(current, from, to));
    const setItemTempo = (index: number, value: string) =>
        setItems((current) => withItemTempo(current, index, value));
    const setItemNote = (index: number, value: string) =>
        setItems((current) => withItemNote(current, index, value));

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
