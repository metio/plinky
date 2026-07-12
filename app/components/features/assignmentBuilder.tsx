// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useMemo } from "react";
import { MAX_DESCRIPTION_LENGTH } from "../../../core/assignment";
import type { AssignmentDraft } from "../../hooks/useAssignmentDraft";
import { useDragReorder } from "../../hooks/useDragReorder";
import { m } from "../../paraglide/messages.js";
import { Button, IconButton } from "../ui/button";
import { compactFieldClasses as FIELD } from "../ui/classes";
import { ArrowDownIcon, ArrowUpIcon, CloseIcon } from "../ui/icons";
import { Show } from "./conditional";

// A pickable piece for the builder: a catalogue score or a finger exercise, both
// reduced to the id and title the basket needs.
export type PoolItem = { id: string; title: string };

// The builder face of the assignments page: search the pool, assemble and order
// the basket (drag or arrows), attach per-step tempo/notes, name it, save or
// take the draft away as a file or link. All the draft state lives in the
// useAssignmentDraft hook the route hands in; this component only renders it.
export function AssignmentBuilder({
    draft,
    pool,
    titleOf,
    isMissing,
    copiedDraft,
    onSave,
    onDownloadDraft,
    onShareDraft,
    onCancelEdit,
}: {
    draft: AssignmentDraft;
    pool: PoolItem[];
    titleOf: (id: string) => string;
    isMissing: (id: string) => boolean;
    // Whether the draft's own Share button just copied its link.
    copiedDraft: boolean;
    onSave: () => void;
    onDownloadDraft: () => void;
    onShareDraft: () => void;
    onCancelEdit: () => void;
}) {
    // Drag-to-reorder for the basket rows; the arrow buttons stay as the
    // keyboard and assistive-tech path.
    const drag = useDragReorder(draft.reorder);

    const matches = useMemo(() => {
        const q = draft.query.trim().toLowerCase();
        const chosen = new Set(draft.items.map((item) => item.id));
        // A blank query browses the whole catalogue rather than showing nothing, so a
        // teacher can build an assignment without first guessing a title to type.
        return pool.filter(
            (entry) => !chosen.has(entry.id) && (q === "" || entry.title.toLowerCase().includes(q)),
        );
    }, [pool, draft.query, draft.items]);

    return (
        <section className="space-y-3">
            <h2 className="font-semibold">{m.assignments_build_heading()}</h2>
            {draft.editingId && (
                <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-200">
                    {m.assignments_editing({ name: draft.name })}
                </p>
            )}
            <input
                className={`${FIELD} w-full`}
                placeholder={m.assignments_search_placeholder()}
                value={draft.query}
                onChange={(event) => draft.setQuery(event.target.value)}
                aria-label={m.assignments_search_placeholder()}
            />
            <Show when={matches.length > 0}>
                <ul className="divide-y divide-gray-100 rounded-md border border-gray-200 dark:divide-gray-800 dark:border-gray-800">
                    {matches.slice(0, draft.visible).map((entry) => (
                        <li
                            key={entry.id}
                            className="flex items-center justify-between gap-2 px-3 py-1.5 text-sm"
                        >
                            <span className="truncate">{entry.title}</span>
                            <Button variant="secondary" onClick={() => draft.addItem(entry.id)}>
                                {m.assignments_add()}
                            </Button>
                        </li>
                    ))}
                </ul>
            </Show>
            <Show when={draft.visible < matches.length}>
                <Button variant="secondary" onClick={draft.showMore}>
                    {m.library_show_more()}
                </Button>
            </Show>

            {draft.items.length > 0 ? (
                <>
                    <ol className="space-y-2" ref={drag.listRef}>
                        {draft.items.map((item, index) => (
                            <li
                                key={item.id}
                                className={`flex flex-wrap items-center gap-2 rounded-md border px-3 py-2 text-sm ${
                                    drag.dragIndex === index
                                        ? "border-indigo-400 opacity-60"
                                        : drag.dragIndex !== null && drag.overIndex === index
                                          ? "border-indigo-400 ring-2 ring-indigo-300 dark:ring-indigo-700"
                                          : "border-gray-200 dark:border-gray-800"
                                }`}
                            >
                                <span className="font-mono text-xs text-gray-400">
                                    {index + 1}.
                                </span>
                                {/* The title doubles as the drag handle (pointer events
                                    cover mouse and touch); the arrow buttons stay as the
                                    keyboard path, so this handle is not a tab stop. */}
                                {isMissing(item.id) ? (
                                    <span
                                        {...drag.handleProps(index)}
                                        className="flex-1 cursor-grab select-none truncate italic text-gray-400 active:cursor-grabbing dark:text-gray-500"
                                    >
                                        {m.assignments_step_missing()}
                                    </span>
                                ) : (
                                    <span
                                        {...drag.handleProps(index)}
                                        className="flex-1 cursor-grab select-none truncate active:cursor-grabbing"
                                    >
                                        {titleOf(item.id)}
                                    </span>
                                )}
                                <input
                                    type="number"
                                    min={20}
                                    max={400}
                                    className={`${FIELD} w-20`}
                                    placeholder={m.assignments_tempo_placeholder()}
                                    value={item.tempo ?? ""}
                                    onChange={(event) =>
                                        draft.setItemTempo(index, event.target.value)
                                    }
                                    aria-label={m.assignments_tempo_label({
                                        title: titleOf(item.id),
                                    })}
                                />
                                <input
                                    className={`${FIELD} w-40`}
                                    placeholder={m.assignments_note_placeholder()}
                                    value={item.note ?? ""}
                                    onChange={(event) =>
                                        draft.setItemNote(index, event.target.value)
                                    }
                                    aria-label={m.assignments_note_label({
                                        title: titleOf(item.id),
                                    })}
                                />
                                <span className="flex gap-1">
                                    <IconButton
                                        variant="secondary"
                                        disabled={index === 0}
                                        onClick={() => draft.moveItem(index, -1)}
                                        label={m.assignments_move_up()}
                                    >
                                        <ArrowUpIcon className="h-5 w-5" />
                                    </IconButton>
                                    <IconButton
                                        variant="secondary"
                                        disabled={index === draft.items.length - 1}
                                        onClick={() => draft.moveItem(index, 1)}
                                        label={m.assignments_move_down()}
                                    >
                                        <ArrowDownIcon className="h-5 w-5" />
                                    </IconButton>
                                    <IconButton
                                        variant="ghost"
                                        onClick={() => draft.removeItem(index)}
                                        label={m.assignments_remove()}
                                        className="text-red-600 dark:text-red-400"
                                    >
                                        <CloseIcon className="h-5 w-5" />
                                    </IconButton>
                                </span>
                            </li>
                        ))}
                    </ol>
                    <p className="text-xs text-gray-400 dark:text-gray-500">
                        {m.assignments_reorder_hint()}
                    </p>
                </>
            ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                    {m.assignments_empty_basket()}
                </p>
            )}

            {/* Naming sits right above Save so the last step before saving
                is in view — the disabled button explains itself. The
                description gets a full-width textarea: it holds real
                instructions, not a one-line label. */}
            <div className="flex flex-col gap-2">
                <input
                    className={`${FIELD} w-full`}
                    placeholder={m.assignments_name_placeholder()}
                    value={draft.name}
                    onChange={(event) => draft.setName(event.target.value)}
                    aria-label={m.assignments_name_label()}
                />
                <textarea
                    className={`${FIELD} min-h-24 w-full resize-y leading-relaxed`}
                    rows={4}
                    maxLength={MAX_DESCRIPTION_LENGTH}
                    placeholder={m.assignments_description_placeholder()}
                    value={draft.description}
                    onChange={(event) => draft.setDescription(event.target.value)}
                    aria-label={m.assignments_description_label()}
                />
            </div>
            <div className="flex flex-wrap gap-2">
                <Button variant="primary" disabled={!draft.canSave} onClick={onSave}>
                    {m.assignments_save()}
                </Button>
                <Button variant="secondary" disabled={!draft.canSave} onClick={onDownloadDraft}>
                    {m.assignments_download()}
                </Button>
                <Button variant="secondary" disabled={!draft.canSave} onClick={onShareDraft}>
                    {copiedDraft ? m.share_copied() : m.assignments_share()}
                </Button>
                {draft.editingId && (
                    <Button variant="secondary" onClick={onCancelEdit}>
                        {m.action_cancel()}
                    </Button>
                )}
            </div>
            <Show when={!draft.canSave}>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                    {m.assignments_save_hint()}
                </p>
            </Show>
        </section>
    );
}
