// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { Button, IconButton } from "../components/button";
import { Show } from "../components/conditional";
import { ArrowDownIcon, ArrowUpIcon, CheckIcon, CloseIcon } from "../components/icons";
import { LocalizedLink as Link } from "../components/localizedLink";
import {
    type Assignment,
    type AssignmentItem,
    decodeAssignmentLink,
    encodeAssignmentLink,
    loadAssignments,
    makeAssignment,
    newAssignmentId,
    parseAssignment,
    removeAssignment,
    saveAssignment,
    serializeAssignment,
    slugifyName,
} from "../lib/assignment";
import { loadCatalog } from "../lib/catalog";
import type { ExerciseMeta } from "../stores/exerciseSource";
import { useExerciseSource, useMasteryStore } from "../contexts/services";
import type { MasteryStore } from "../stores/masteryStore";
import { routeMeta, SITE_URL } from "../../core/site";
import { trackSteps } from "../../core/tracks";
import { m } from "../paraglide/messages.js";
import { localizeHref } from "../paraglide/runtime.js";
import type { Route } from "./+types/assignments";

export function meta(_args: Route.MetaArgs) {
    return routeMeta(m.assignments_heading(), m.meta_assignments_description());
}

const FIELD =
    "rounded-md border border-gray-300 bg-transparent px-2 py-1 text-sm text-gray-700 dark:border-gray-700 dark:text-gray-300";

// A pickable piece for the builder: a catalogue score or a finger exercise, both
// reduced to the id and title the basket needs.
type PoolItem = { id: string; title: string };

// A step is cleared once its piece has been learned.
function done(id: string, mastery: MasteryStore): boolean {
    return mastery.load(id)?.learned === true;
}

const STEP_MARK =
    "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold";

// Trigger a file download of text content the browser keeps on the device.
function download(filename: string, text: string, type: string): void {
    const blob = new Blob([text], { type });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
}

export default function AssignmentsRoute() {
    const masteryStore = useMasteryStore();
    const exercises = useExerciseSource();
    const [searchParams] = useSearchParams();
    const [pool, setPool] = useState<PoolItem[]>([]);
    const [assignments, setAssignments] = useState<Assignment[]>([]);
    const [incoming, setIncoming] = useState<Assignment | null>(null);
    const [status, setStatus] = useState<string | null>(null);
    const fileRef = useRef<HTMLInputElement>(null);

    // Builder state.
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [items, setItems] = useState<AssignmentItem[]>([]);
    const [query, setQuery] = useState("");

    useEffect(() => {
        setAssignments(loadAssignments());
        exercises.manifest().then((exercises: ExerciseMeta[]) => {
            const fromCatalog = loadCatalog().map((score) => ({
                id: score.id,
                title: score.title,
            }));
            const fromExercises = exercises.map((exercise) => ({
                id: exercise.id,
                title: exercise.title,
            }));
            setPool([...fromCatalog, ...fromExercises]);
        });
    }, [exercises.manifest]);

    // A shared assignment arriving by link is offered for import rather than saved
    // silently, so the player chooses to add a stranger's list to their own.
    useEffect(() => {
        setIncoming(decodeAssignmentLink(searchParams.get("assignment") ?? ""));
    }, [searchParams]);

    const titleOf = useMemo(() => {
        const byId = new Map(pool.map((entry) => [entry.id, entry.title]));
        return (id: string) => byId.get(id) ?? id;
    }, [pool]);

    const matches = useMemo(() => {
        const q = query.trim().toLowerCase();
        const chosen = new Set(items.map((item) => item.id));
        // A blank query browses the catalogue (the first 20 unused pieces) rather than
        // showing nothing, so a teacher can build an assignment without first guessing
        // a title to type.
        return pool
            .filter(
                (entry) =>
                    !chosen.has(entry.id) && (q === "" || entry.title.toLowerCase().includes(q)),
            )
            .slice(0, 20);
    }, [pool, query, items]);

    const refresh = () => setAssignments(loadAssignments());

    const addItem = (id: string) => {
        setItems((current) =>
            current.some((item) => item.id === id) ? current : [...current, { id }],
        );
    };
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

    const draft = (): Assignment => {
        const existing = loadAssignments().map((entry) => entry.id);
        return makeAssignment({ id: newAssignmentId(name, existing), name, description, items });
    };

    const reset = () => {
        setName("");
        setDescription("");
        setItems([]);
        setQuery("");
    };

    const canSave = name.trim().length > 0 && items.length > 0;

    const onSave = () => {
        const assignment = draft();
        if (saveAssignment(assignment)) {
            refresh();
            reset();
            setStatus(m.assignments_saved({ name: assignment.name }));
        } else {
            setStatus(m.assignments_save_failed());
        }
    };

    const onDownload = (assignment: Assignment) =>
        download(
            `${slugifyName(assignment.name)}.json`,
            serializeAssignment(assignment),
            "application/json",
        );

    const onShare = async (assignment: Assignment) => {
        const url = `${SITE_URL}${localizeHref("/assignments")}?assignment=${encodeAssignmentLink(assignment)}`;
        try {
            if (typeof navigator.share === "function") {
                await navigator.share({
                    url,
                    text: m.assignments_share_boast({ name: assignment.name }),
                });
            } else {
                await navigator.clipboard?.writeText(url);
                setStatus(m.assignments_link_copied());
            }
        } catch {
            // A cancelled share or blocked clipboard needs no message.
        }
    };

    const onDelete = (assignment: Assignment) => {
        removeAssignment(assignment.id);
        refresh();
    };

    // Re-id an imported assignment so it can't overwrite one already saved under the
    // same name, then store it and surface it in the list.
    const importAssignment = (assignment: Assignment) => {
        const existing = loadAssignments().map((entry) => entry.id);
        const stored = existing.includes(assignment.id)
            ? makeAssignment({ ...assignment, id: newAssignmentId(assignment.name, existing) })
            : assignment;
        if (saveAssignment(stored)) {
            refresh();
            setStatus(m.assignments_imported({ name: stored.name }));
        } else {
            setStatus(m.assignments_save_failed());
        }
    };

    const importFile = async (file: File | undefined) => {
        if (!file) {
            return;
        }
        try {
            importAssignment(parseAssignment(await file.text()));
        } catch (error) {
            setStatus(error instanceof Error ? error.message : m.assignments_save_failed());
        }
    };

    return (
        <main className="mx-auto max-w-3xl space-y-8 p-6 font-sans">
            <header className="space-y-1">
                <h1 className="text-2xl font-semibold">{m.assignments_heading()}</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">{m.assignments_intro()}</p>
            </header>

            {status && (
                <p
                    role="status"
                    className="rounded-md bg-indigo-50 px-3 py-2 text-sm text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200"
                >
                    {status}
                </p>
            )}

            {incoming && (
                <section className="space-y-2 rounded-md border border-indigo-200 bg-indigo-50/50 p-4 dark:border-indigo-900 dark:bg-indigo-950/30">
                    <h2 className="font-semibold">{m.assignments_received_heading()}</h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                        {m.assignments_received_detail({
                            name: incoming.name,
                            count: incoming.items.length,
                        })}
                    </p>
                    <Button
                        variant="primary"
                        onClick={() => {
                            importAssignment(incoming);
                            setIncoming(null);
                        }}
                    >
                        {m.assignments_import_received()}
                    </Button>
                </section>
            )}

            <section className="space-y-3">
                <h2 className="font-semibold">{m.assignments_build_heading()}</h2>
                <div className="flex flex-col gap-2 sm:flex-row">
                    <input
                        className={`${FIELD} flex-1`}
                        placeholder={m.assignments_name_placeholder()}
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        aria-label={m.assignments_name_label()}
                    />
                    <input
                        className={`${FIELD} flex-1`}
                        placeholder={m.assignments_description_placeholder()}
                        value={description}
                        onChange={(event) => setDescription(event.target.value)}
                        aria-label={m.assignments_description_label()}
                    />
                </div>

                <input
                    className={`${FIELD} w-full`}
                    placeholder={m.assignments_search_placeholder()}
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    aria-label={m.assignments_search_placeholder()}
                />
                <Show when={matches.length > 0}>
                    <ul className="divide-y divide-gray-100 rounded-md border border-gray-200 dark:divide-gray-800 dark:border-gray-800">
                        {matches.map((entry) => (
                            <li
                                key={entry.id}
                                className="flex items-center justify-between gap-2 px-3 py-1.5 text-sm"
                            >
                                <span className="truncate">{entry.title}</span>
                                <Button variant="secondary" onClick={() => addItem(entry.id)}>
                                    {m.assignments_add()}
                                </Button>
                            </li>
                        ))}
                    </ul>
                </Show>

                {items.length > 0 ? (
                    <ol className="space-y-2">
                        {items.map((item, index) => (
                            <li
                                key={item.id}
                                className="flex flex-wrap items-center gap-2 rounded-md border border-gray-200 px-3 py-2 text-sm dark:border-gray-800"
                            >
                                <span className="font-mono text-xs text-gray-400">
                                    {index + 1}.
                                </span>
                                <span className="flex-1 truncate">{titleOf(item.id)}</span>
                                <input
                                    type="number"
                                    min={20}
                                    max={400}
                                    className={`${FIELD} w-20`}
                                    placeholder={m.assignments_tempo_placeholder()}
                                    value={item.tempo ?? ""}
                                    onChange={(event) => setItemTempo(index, event.target.value)}
                                    aria-label={m.assignments_tempo_label({
                                        title: titleOf(item.id),
                                    })}
                                />
                                <input
                                    className={`${FIELD} w-40`}
                                    placeholder={m.assignments_note_placeholder()}
                                    value={item.note ?? ""}
                                    onChange={(event) => setItemNote(index, event.target.value)}
                                    aria-label={m.assignments_note_label({
                                        title: titleOf(item.id),
                                    })}
                                />
                                <span className="flex gap-1">
                                    <IconButton
                                        variant="secondary"
                                        disabled={index === 0}
                                        onClick={() => moveItem(index, -1)}
                                        label={m.assignments_move_up()}
                                    >
                                        <ArrowUpIcon className="h-5 w-5" />
                                    </IconButton>
                                    <IconButton
                                        variant="secondary"
                                        disabled={index === items.length - 1}
                                        onClick={() => moveItem(index, 1)}
                                        label={m.assignments_move_down()}
                                    >
                                        <ArrowDownIcon className="h-5 w-5" />
                                    </IconButton>
                                    <IconButton
                                        variant="ghost"
                                        onClick={() => removeItem(index)}
                                        label={m.assignments_remove()}
                                        className="text-red-600 dark:text-red-400"
                                    >
                                        <CloseIcon className="h-5 w-5" />
                                    </IconButton>
                                </span>
                            </li>
                        ))}
                    </ol>
                ) : (
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        {m.assignments_empty_basket()}
                    </p>
                )}

                <div className="flex flex-wrap gap-2">
                    <Button variant="primary" disabled={!canSave} onClick={onSave}>
                        {m.assignments_save()}
                    </Button>
                    <Button
                        variant="secondary"
                        disabled={!canSave}
                        onClick={() => onDownload(draft())}
                    >
                        {m.assignments_download()}
                    </Button>
                    <Button
                        variant="secondary"
                        disabled={!canSave}
                        onClick={() => onShare(draft())}
                    >
                        {m.assignments_share()}
                    </Button>
                </div>
            </section>

            <section className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                    <h2 className="font-semibold">{m.assignments_yours_heading()}</h2>
                    <Button variant="secondary" onClick={() => fileRef.current?.click()}>
                        {m.assignments_import_file()}
                    </Button>
                    <input
                        ref={fileRef}
                        type="file"
                        accept="application/json,.json"
                        className="hidden"
                        onChange={(event) => {
                            importFile(event.target.files?.[0]);
                            event.target.value = "";
                        }}
                    />
                </div>
                {assignments.length === 0 ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        {m.assignments_yours_empty()}
                    </p>
                ) : (
                    <ul className="space-y-2">
                        {assignments.map((assignment) => {
                            const steps = trackSteps(
                                assignment.items.map((item) => item.id),
                                (id) => done(id, masteryStore),
                            );
                            const doneCount = steps.filter((step) => step.status === "done").length;
                            return (
                                <li
                                    key={assignment.id}
                                    className="space-y-2 rounded-md border border-gray-200 px-3 py-2 text-sm dark:border-gray-800"
                                >
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="flex-1">
                                            <span className="font-medium">{assignment.name}</span>{" "}
                                            <span className="tabular-nums text-gray-500 dark:text-gray-400">
                                                {doneCount}/{steps.length}
                                            </span>
                                        </span>
                                        <Button
                                            variant="secondary"
                                            onClick={() => onShare(assignment)}
                                        >
                                            {m.assignments_share()}
                                        </Button>
                                        <Button
                                            variant="secondary"
                                            onClick={() => onDownload(assignment)}
                                        >
                                            {m.assignments_download()}
                                        </Button>
                                        <Button
                                            variant="danger"
                                            onClick={() => onDelete(assignment)}
                                            aria-label={m.assignments_delete_label({
                                                name: assignment.name,
                                            })}
                                        >
                                            {m.assignments_remove()}
                                        </Button>
                                    </div>
                                    <ol className="space-y-1">
                                        {steps.map((step, index) => (
                                            <li
                                                key={step.scoreId}
                                                className="flex items-center gap-2"
                                            >
                                                <span
                                                    aria-hidden="true"
                                                    className={`${STEP_MARK} ${
                                                        step.status === "done"
                                                            ? "bg-green-600 text-white"
                                                            : step.status === "current"
                                                              ? "bg-indigo-600 text-white"
                                                              : "bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300"
                                                    }`}
                                                >
                                                    {step.status === "done" ? (
                                                        <CheckIcon className="h-4 w-4" />
                                                    ) : (
                                                        index + 1
                                                    )}
                                                </span>
                                                <Link
                                                    to={`/play/${step.scoreId}`}
                                                    className={
                                                        step.status === "current"
                                                            ? "font-medium text-indigo-700 dark:text-indigo-300"
                                                            : "text-gray-700 hover:underline dark:text-gray-300"
                                                    }
                                                >
                                                    {titleOf(step.scoreId)}
                                                </Link>
                                            </li>
                                        ))}
                                    </ol>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </section>

            <Link to="/" className="text-sm text-indigo-700 underline dark:text-indigo-300">
                {m.action_back_home()}
            </Link>
        </main>
    );
}
