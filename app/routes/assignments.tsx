// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { shareOrCopy } from "../lib/shareOrCopy";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { Button } from "../components/ui/button";
import { ReportBack } from "../components/features/reportBack";
import { linkClasses, sectionHeadingClasses } from "../components/ui/classes";
import { LocalizedLink } from "../components/ui/localizedLink";
import { downloadBlob } from "../lib/download";
import { Show } from "../components/features/conditional";
import {
    AssignmentCard,
    AssignmentStepList,
    type AssignmentSteps,
} from "../components/features/assignmentCard";
import { AssignmentBuilder, type PoolItem } from "../components/features/assignmentBuilder";
import {
    availableItemCount,
    decodeAssignmentLink,
    encodeAssignmentLink,
    missingAssignmentIds,
    parseAssignment,
    pruneAssignment,
    serializeAssignment,
    slugifyName,
    type Assignment,
    withFreeId,
} from "../../core/assignment";
import { SegmentedControl } from "../components/ui/segmentedControl";
import { useAssignmentDraft } from "../hooks/useAssignmentDraft";
import { useCopied } from "../hooks/useCopied";
import { useKnownPieces } from "../hooks/useKnownPieces";
import { loadBundledScores, loadCatalog } from "../lib/catalog";
import { catalogueAssignment, starterAssignment } from "../../core/starterAssignments";
import type { ExerciseMeta } from "../stores/exerciseSource";
import {
    useAssignmentsStore,
    useExerciseSource,
    useMasteryStore,
    useStore,
    useSongSource,
} from "../contexts/services";
import { routeMeta, SITE_URL } from "../../core/site";
import { trackSteps } from "../../core/tracks";
import { m } from "../paraglide/messages.js";
import type { Route } from "./+types/assignments";
import { localizedHref } from "../components/ui/href";
import { PageHeader } from "../components/ui/pageHeader";

export function meta(_args: Route.MetaArgs) {
    return routeMeta(m.assignments_heading(), m.meta_assignments_description());
}

export default function AssignmentsRoute() {
    const store = useStore();
    const assignmentsStore = useAssignmentsStore();
    const masteryStore = useMasteryStore();
    const exercises = useExerciseSource();
    const songs = useSongSource();
    // Whether a step's id resolves anywhere the play page can — indeterminate
    // (never "missing") until every source has loaded.
    const known = useKnownPieces();
    const [searchParams] = useSearchParams();
    const [pool, setPool] = useState<PoolItem[]>([]);
    const [assignments, setAssignments] = useState<Assignment[]>([]);
    // Curated, always-available sets assembled from the shipped catalogue — not stored,
    // so they track the catalogue instead of a snapshot in localStorage.
    // The starter and the named works are kept apart because they arrive on separate
    // fetches. Held in one array, whichever resolved second replaced the other.
    const [starter, setStarter] = useState<Assignment | null>(null);
    const [namedWorks, setNamedWorks] = useState<Assignment[]>([]);
    const [incoming, setIncoming] = useState<Assignment | null>(null);
    const [status, setStatus] = useState<string | null>(null);
    const fileRef = useRef<HTMLInputElement>(null);
    // Which Share button just copied its link — "draft" or a saved assignment's id —
    // so the confirmation shows on the button that was pressed, not only in the status
    // line that can sit scrolled far above it.
    const [copiedShare, flashCopied] = useCopied();

    const draft = useAssignmentDraft();
    // Which face of the page shows: the assignment lists, or the one draft the
    // builder holds. Component state, like every tab in the app — the builder's
    // draft survives a peek at the list, and no history entries pile up.
    const [tab, setTab] = useState<"list" | "builder">("list");

    useEffect(() => {
        setAssignments(assignmentsStore.list());
        // A failed manifest (null) leaves the picker to the local catalogue for
        // now; missing-ness is judged by useKnownPieces, never by this pool.
        exercises.manifest().then((manifest: ExerciseMeta[] | null) => {
            const exercises = manifest ?? [];
            const fromCatalog = loadCatalog(store).map((score) => ({
                id: score.id,
                title: score.title,
            }));
            const fromExercises = exercises.map((exercise) => ({
                id: exercise.id,
                title: exercise.title,
            }));
            // Content-fingerprint ids can collide across sources (an import matching a
            // catalogue piece). Keep the first occurrence so the picker never renders
            // duplicate ids — which would collide as React keys — and titleOf labels a
            // step with the surviving entry's title.
            const seen = new Set<string>();
            setPool(
                [...fromCatalog, ...fromExercises].filter((entry) => {
                    if (seen.has(entry.id)) {
                        return false;
                    }
                    seen.add(entry.id);
                    return true;
                }),
            );
            setStarter(
                starterAssignment({
                    id: "starter-first-steps",
                    name: m.assignments_starter_name(),
                    description: m.assignments_starter_description(),
                    demos: loadBundledScores().map((score) => ({ id: score.id })),
                    exercises,
                }),
            );
        });
        // The named works, after the starter rather than with it: they are a shelf to
        // browse and the starter is where a first day begins, so it stays at the top and
        // does not wait on a second fetch to appear.
        songs.builtins().then((sets) => {
            setNamedWorks(
                (sets ?? [])
                    .map((set) => catalogueAssignment({ set, known: () => true }))
                    .filter((assignment): assignment is Assignment => assignment !== null),
            );
        });
    }, [exercises.manifest, songs.builtins, store, assignmentsStore.list]);

    // A shared assignment arriving by link is offered for import rather than saved
    // silently, so the player chooses to add a stranger's list to their own.
    useEffect(() => {
        setIncoming(decodeAssignmentLink(searchParams.get("assignment") ?? ""));
    }, [searchParams]);

    // The picker pool covers the catalogue and exercises; songs are labelled from
    // the wider known-pieces set, and an unresolved id falls back to itself.
    // Built once per pool, not once per keystroke in the builder: the pool is the whole
    // catalogue plus the exercises.
    const byId = useMemo(() => new Map(pool.map((entry) => [entry.id, entry.title])), [pool]);
    const titleOf = (id: string) => byId.get(id) ?? known.titleOf(id) ?? id;

    // The starter first — where a first day begins — then the named works below it.
    const builtin = starter ? [starter, ...namedWorks] : namedWorks;

    // The steps of an assignment whose ids no longer resolve on this device.
    const missingIn = (assignment: Assignment) =>
        missingAssignmentIds(assignment.items, (id) => !known.isMissing(id));

    const refresh = () => setAssignments(assignmentsStore.list());

    const currentDraft = () => draft.draft(assignmentsStore.list().map((entry) => entry.id));

    const startEdit = (assignment: Assignment) => {
        draft.startEdit(assignment);
        setTab("builder");
        window.scrollTo({ top: 0 });
    };

    const cancelEdit = () => {
        draft.reset();
        setTab("list");
    };

    const stepsFor = (assignment: Assignment) =>
        trackSteps(
            assignment.items.map((item) => item.id),
            // A step is cleared once its piece has been learned.
            (id) => masteryStore.load(id)?.learned === true,
        );

    const steps = (list: AssignmentSteps) => (
        <AssignmentStepList
            steps={list}
            titleOf={titleOf}
            isMissing={known.isMissing}
            incipitOf={known.incipitOf}
        />
    );

    const onSave = () => {
        const assignment = currentDraft();
        if (assignmentsStore.save(assignment)) {
            refresh();
            draft.reset();
            // Land back on the list with the saved assignment in view — the
            // builder is empty again, ready for the next one.
            setTab("list");
            setStatus(m.assignments_saved({ name: assignment.name }));
        } else {
            setStatus(m.assignments_save_failed());
        }
    };

    const shareUrl = (assignment: Assignment) =>
        `${SITE_URL}${localizedHref("/assignments")}?assignment=${encodeAssignmentLink(assignment)}`;

    const onDownload = (assignment: Assignment) =>
        downloadBlob(
            serializeAssignment(assignment),
            "application/json",
            `${slugifyName(assignment.name)}.json`,
        );

    const onShare = async (assignment: Assignment, buttonKey: string) => {
        const url = shareUrl(assignment);
        await shareOrCopy({
            share: { url, text: m.assignments_share_boast({ name: assignment.name }) },
            copy: url,
            // Confirm on the button itself, reverting after a moment; the status line
            // repeats it for assistive tech.
            onCopied: () => {
                flashCopied(buttonKey);
                setStatus(m.assignments_link_copied());
            },
        });
    };

    const onDelete = (assignment: Assignment) => {
        assignmentsStore.remove(assignment.id);
        refresh();
    };

    // Save the assignment with its missing steps dropped. The confirmation is
    // gated on the store's verdict, so a failed write never reads as a save.
    const onPruneMissing = (assignment: Assignment) => {
        const pruned = pruneAssignment(assignment, (id) => !known.isMissing(id));
        if (assignmentsStore.save(pruned)) {
            refresh();
            setStatus(m.assignments_missing_removed({ name: pruned.name }));
        } else {
            setStatus(m.assignments_save_failed());
        }
    };

    // Re-id an imported assignment so it can't overwrite one already saved under the
    // same name, then store it and surface it in the list.
    const importAssignment = (assignment: Assignment) => {
        const stored = withFreeId(
            assignment,
            assignmentsStore.list().map((entry) => entry.id),
        );
        if (assignmentsStore.save(stored)) {
            refresh();
            // With the sources loaded, an import whose pieces don't all resolve says
            // so — the steps still land, marked missing, and play once imported.
            const available = availableItemCount(stored.items, (id) => !known.isMissing(id));
            setStatus(
                known.ready && available < stored.items.length
                    ? m.assignments_imported_partial({
                          name: stored.name,
                          available,
                          total: stored.items.length,
                      })
                    : m.assignments_imported({ name: stored.name }),
            );
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
            <PageHeader title={m.assignments_heading()} hint={m.assignments_intro()} />

            {status && (
                <p
                    role="status"
                    className="rounded-md bg-accent-surface px-3 py-2 text-sm text-accent-deep"
                >
                    {status}
                </p>
            )}

            <SegmentedControl
                options={[
                    { id: "list", label: m.assignments_tab_list() },
                    {
                        id: "builder",
                        label: draft.editingId
                            ? m.assignments_tab_edit()
                            : m.assignments_tab_create(),
                    },
                ]}
                value={tab}
                onChange={setTab}
                label={m.assignments_heading()}
            />

            {tab === "list" && incoming && (
                <section className="space-y-2 rounded-md border border-accent-line bg-accent-surface/50 p-4 dark:bg-accent-surface/30">
                    <h2 className={sectionHeadingClasses}>{m.assignments_received_heading()}</h2>
                    <p className="text-sm text-muted">
                        {m.assignments_received_detail({
                            name: incoming.name,
                            count: incoming.items.length,
                        })}
                    </p>
                    <Show when={known.ready}>
                        <p className="text-sm text-muted">
                            {m.assignments_available_count({
                                available: availableItemCount(
                                    incoming.items,
                                    (id) => !known.isMissing(id),
                                ),
                                total: incoming.items.length,
                            })}
                        </p>
                    </Show>
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

            {tab === "builder" && (
                <AssignmentBuilder
                    draft={draft}
                    pool={pool}
                    titleOf={titleOf}
                    isMissing={known.isMissing}
                    copiedDraft={copiedShare === "draft"}
                    onSave={onSave}
                    onDownloadDraft={() => onDownload(currentDraft())}
                    onShareDraft={() => onShare(currentDraft(), "draft")}
                    onCancelEdit={cancelEdit}
                />
            )}

            <Show when={tab === "list" && builtin.length > 0}>
                {() => (
                    <section className="space-y-3">
                        <h2 className={sectionHeadingClasses}>{m.assignments_builtin_heading()}</h2>
                        <ul className="space-y-2">
                            {builtin.map((assignment, index) => {
                                const list = stepsFor(assignment);
                                return (
                                    <AssignmentCard
                                        key={assignment.id}
                                        assignment={assignment}
                                        steps={list}
                                        copiedShare={copiedShare}
                                        onShare={onShare}
                                        onDownload={onDownload}
                                        description={assignment.description}
                                        // The first is the starter — where a first day begins,
                                        // so it is open. The named works below it are a shelf.
                                        foldSteps={index > 0}
                                    >
                                        {steps(list)}
                                        <ReportBack assignment={assignment} />
                                    </AssignmentCard>
                                );
                            })}
                        </ul>
                        <p className="text-sm text-muted">
                            {m.assignments_collect_hint()}{" "}
                            <LocalizedLink to="/collect" className={linkClasses}>
                                {m.collect_title()}
                            </LocalizedLink>
                        </p>
                    </section>
                )}
            </Show>

            {tab === "list" && (
                <section className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <h2 className={sectionHeadingClasses}>{m.assignments_yours_heading()}</h2>
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
                        <p className="text-sm text-muted">{m.assignments_yours_empty()}</p>
                    ) : (
                        <ul className="space-y-2">
                            {assignments.map((assignment) => {
                                const list = stepsFor(assignment);
                                const missing = missingIn(assignment);
                                const survivors = availableItemCount(
                                    assignment.items,
                                    (id) => !known.isMissing(id),
                                );
                                return (
                                    <AssignmentCard
                                        key={assignment.id}
                                        assignment={assignment}
                                        steps={list}
                                        copiedShare={copiedShare}
                                        onShare={onShare}
                                        onDownload={onDownload}
                                        description={assignment.description}
                                        actionsBefore={
                                            <>
                                                {missing.length > 0 && (
                                                    <Button
                                                        variant="secondary"
                                                        // Pruning every step would leave an empty
                                                        // assignment; deletion is the honest action then.
                                                        disabled={survivors === 0}
                                                        onClick={() => onPruneMissing(assignment)}
                                                        aria-label={m.assignments_remove_missing_label(
                                                            {
                                                                name: assignment.name,
                                                            },
                                                        )}
                                                    >
                                                        {m.assignments_remove_missing()}
                                                    </Button>
                                                )}
                                                <Button
                                                    variant="secondary"
                                                    onClick={() => startEdit(assignment)}
                                                    aria-label={m.assignments_edit_label({
                                                        name: assignment.name,
                                                    })}
                                                >
                                                    {m.assignments_edit()}
                                                </Button>
                                            </>
                                        }
                                        actionsAfter={
                                            <>
                                                {/* Handing the list out through a class
                                                the teacher already runs. A plain link,
                                                not Google's share widget: the widget
                                                would pull a third-party script onto
                                                every assignments page, and this needs
                                                none. */}
                                                <a
                                                    href={`https://classroom.google.com/share?url=${encodeURIComponent(
                                                        shareUrl(assignment),
                                                    )}`}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className={`${linkClasses} text-sm`}
                                                >
                                                    {m.assignments_classroom()}
                                                </a>
                                                <Button
                                                    variant="danger"
                                                    onClick={() => onDelete(assignment)}
                                                    aria-label={m.assignments_delete_label({
                                                        name: assignment.name,
                                                    })}
                                                >
                                                    {m.assignments_remove()}
                                                </Button>
                                            </>
                                        }
                                    >
                                        {steps(list)}
                                        <ReportBack assignment={assignment} />
                                    </AssignmentCard>
                                );
                            })}
                        </ul>
                    )}
                </section>
            )}
        </main>
    );
}
