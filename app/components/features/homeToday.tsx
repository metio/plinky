// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useEffect, useState } from "react";
import { dailyNumber, todayKey } from "../../../core/daily";
import {
    currentGrade,
    dueReviews,
    gradeSuggestions,
    loadGradeCatalogue,
    loadGradedMastery,
} from "../../lib/gradeProgress";
import {
    useAssignmentsStore,
    useExerciseSource,
    usePrefsStore,
    useServices,
} from "../../contexts/services";
import { nextAssignmentStep } from "../../../core/assignment";
import { useKnownPieces } from "../../hooks/useKnownPieces";
import { starterAssignment } from "../../../core/starterAssignments";
import { MAX_GRADE } from "../../../core/scoreDifficulty";
import { type Task, todayTasks } from "../../../core/today";
import { loadBundledScores } from "../../lib/catalog";
import { m } from "../../paraglide/messages.js";
import { LocalizedLink as Link } from "../ui/localizedLink";

const ICON: Record<Task["key"], string> = {
    review: "🔁",
    daily: "📅",
    assignment: "📋",
    learn: "🎹",
    browse: "📚",
};

function taskLabel(task: Task): string {
    switch (task.key) {
        case "review":
            return m.today_review({ count: task.count });
        case "daily":
            return task.done ? m.today_daily_done() : m.today_daily();
        case "assignment":
            return m.today_assignment({ name: task.name, step: task.step, total: task.total });
        case "learn":
            return m.today_learn({ title: task.title });
        case "browse":
            return m.today_browse();
    }
}

// The home page's "open the app, here's what to do" panel: a short, prioritised task
// list (refresh what's fading, the daily, something new) — each a one-tap link
// straight into practice. Reads local state after mount, so it's absent from the
// prerendered shell and appears once the client resolves it.
export function HomeToday() {
    const prefsStore = usePrefsStore();
    const assignmentsStore = useAssignmentsStore();
    const exercises = useExerciseSource();
    const services = useServices();
    // Skips steps whose pieces no longer resolve, so the Continue link never
    // lands on the play page's dead end. While the sources are still loading
    // (or unreachable) nothing reads as missing — the panel never blocks on,
    // or degrades with, the network.
    const known = useKnownPieces();
    const [tasks, setTasks] = useState<Task[] | null>(null);

    useEffect(() => {
        let cancelled = false;
        Promise.all([
            loadGradedMastery(services.mastery, services),
            loadGradeCatalogue(services),
            // The manifest only feeds the starter assignment; without it the
            // panel still stands, so a fetch failure degrades to no starter
            // rather than an empty panel.
            exercises.manifest().then((list) => list ?? []),
        ]).then(([items, catalogue, exerciseList]) => {
            if (cancelled) {
                return;
            }
            const now = Date.now();
            const prefs = prefsStore.load();
            const level = currentGrade(items);
            const workingGrade = Math.min(level + 1, MAX_GRADE);
            const mastered = new Set(
                items.filter((i) => i.mastery.learned && !i.mastery.backlog).map((i) => i.id),
            );
            const suggestion = gradeSuggestions(catalogue, workingGrade, mastered, 1)[0] ?? null;
            const dailyDoneToday = services.daily.lastDone() === dailyNumber(todayKey(new Date()));
            // The player's own assignments first — a saved set is a deliberate
            // path — then the built-in starter, so a fresh device has a guided
            // path in the panel from day one. Same construction as on
            // /assignments, so the two views always agree on the steps.
            const starter = starterAssignment({
                id: "starter-first-steps",
                name: m.assignments_starter_name(),
                description: m.assignments_starter_description(),
                demos: loadBundledScores().map((score) => ({ id: score.id })),
                exercises: exerciseList,
            });
            const assignment = nextAssignmentStep(
                [...assignmentsStore.list(), ...(starter ? [starter] : [])],
                (id) => services.mastery.load(id)?.learned === true,
                (id) => known.isMissing(id),
            );
            setTasks(
                todayTasks({
                    dueIds: dueReviews(items, now, prefs.reviewCap),
                    dailyDoneToday,
                    assignment,
                    suggestion: suggestion ? { id: suggestion.id, title: suggestion.title } : null,
                }),
            );
        });
        return () => {
            cancelled = true;
        };
    }, [prefsStore.load, assignmentsStore.list, exercises.manifest, services, known]);

    if (tasks === null) {
        return null;
    }

    return (
        <section className="space-y-3 rounded-xl border border-indigo-200 bg-indigo-50/50 p-5 dark:border-indigo-900 dark:bg-indigo-950/30">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-indigo-700 dark:text-indigo-300">
                {m.today_heading()}
            </h2>
            <ul className="space-y-2">
                {tasks.map((task) => (
                    <li key={task.key}>
                        <Link
                            to={task.to}
                            className="group flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-3 transition hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-sm dark:border-gray-800 dark:bg-gray-900 dark:hover:border-indigo-700"
                        >
                            <span aria-hidden="true" className="text-xl">
                                {task.key === "daily" && task.done ? "✅" : ICON[task.key]}
                            </span>
                            <span className="font-medium text-gray-900 group-hover:text-indigo-700 dark:text-gray-100 dark:group-hover:text-indigo-300">
                                {taskLabel(task)} →
                            </span>
                        </Link>
                    </li>
                ))}
            </ul>
        </section>
    );
}
