// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { Meta, StoryObj } from "@storybook/react-vite";
import { type AssignmentItem, makeAssignment } from "../../../core/assignment";
import type { AssignmentDraft } from "../../hooks/useAssignmentDraft";
import { AssignmentBuilder } from "./assignmentBuilder";

const meta: Meta<typeof AssignmentBuilder> = {
    title: "Features/AssignmentBuilder",
    component: AssignmentBuilder,
};
export default meta;

type Story = StoryObj<typeof AssignmentBuilder>;

const POOL = [
    { id: "minuet", title: "Minuet in G" },
    { id: "gymnopedie", title: "Gymnopédie No. 1" },
    { id: "prelude", title: "Prelude in C" },
    { id: "five-finger", title: "Five-finger warm-up" },
];

const TITLES: Record<string, string> = Object.fromEntries(
    POOL.map((entry) => [entry.id, entry.title]),
);

// A draft frozen in one state. The builder holds no state of its own — the route's
// hook owns all of it — so a literal is the whole input.
const draftOf = (parts: {
    name?: string;
    description?: string;
    dueOn?: string;
    items?: AssignmentItem[];
    query?: string;
    editingId?: string | null;
}): AssignmentDraft => {
    const name = parts.name ?? "";
    const items = parts.items ?? [];
    return {
        name,
        setName: () => {},
        description: parts.description ?? "",
        setDescription: () => {},
        dueOn: parts.dueOn ?? "",
        setDueOn: () => {},
        items,
        query: parts.query ?? "",
        setQuery: () => {},
        visible: 20,
        showMore: () => {},
        editingId: parts.editingId ?? null,
        canSave: name.trim().length > 0 && items.length > 0,
        addItem: () => {},
        removeItem: () => {},
        moveItem: () => {},
        reorder: () => {},
        setItemTempo: () => {},
        setItemNote: () => {},
        draft: () => makeAssignment({ id: "demo", name, items }),
        reset: () => {},
        startEdit: () => {},
    };
};

const show = (draft: AssignmentDraft, missing: string[] = []) => (
    <AssignmentBuilder
        draft={draft}
        pool={POOL}
        titleOf={(id) => TITLES[id] ?? id}
        isMissing={(id) => missing.includes(id)}
        copiedDraft={false}
        onSave={() => {}}
        onDownloadDraft={() => {}}
        onShareDraft={() => {}}
        onCancelEdit={() => {}}
    />
);

// An empty basket: the whole catalogue browsable, Save disabled and saying why.
export const Empty: Story = { render: () => show(draftOf({})) };

// A basket with steps, one carrying a tempo and an instruction. This is the state
// the reorder arrows are drawn for — first row cannot go up, last cannot go down.
export const WithSteps: Story = {
    render: () =>
        show(
            draftOf({
                name: "Week 3",
                description: "Slowly, hands separate, then together on Friday.",
                dueOn: "2026-04-17",
                items: [
                    { id: "five-finger", tempo: 72 },
                    { id: "minuet", tempo: 96, note: "Watch the left-hand leap in bar 9." },
                    { id: "prelude" },
                ],
            }),
        ),
};

// A step whose piece has left the catalogue. It stays in the basket, named as
// missing rather than silently dropped, so the teacher can see what to replace.
export const MissingStep: Story = {
    render: () =>
        show(
            draftOf({
                name: "Week 3",
                items: [{ id: "minuet" }, { id: "gone" }],
            }),
            ["gone"],
        ),
};

// Editing a saved set rather than building a new one: the banner names it, and
// Cancel appears beside Save.
export const Editing: Story = {
    render: () =>
        show(
            draftOf({
                name: "Week 2",
                items: [{ id: "gymnopedie" }],
                editingId: "week-2",
                query: "prel",
            }),
        ),
};
