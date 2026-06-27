// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useEffect, useState } from "react";
import { dailyNumber, todayKey } from "../lib/daily";
import { loadDailyStreak } from "../lib/dailyStreak";
import {
    currentGrade,
    dueReviews,
    gradeSuggestions,
    loadGradeCatalogue,
    loadGradedMastery,
} from "../lib/gradeProgress";
import { currentStreak, loadHistory } from "../lib/history";
import { loadPrefs } from "../lib/prefs";
import { MAX_GRADE } from "../lib/scoreDifficulty";
import { type Task, todayTasks } from "../lib/today";
import { m } from "../paraglide/messages.js";
import { LocalizedLink as Link } from "./localizedLink";

const ICON: Record<Task["key"], string> = {
    review: "🔁",
    daily: "🎯",
    learn: "🎹",
    browse: "📚",
};

function taskLabel(task: Task): string {
    switch (task.key) {
        case "review":
            return m.today_review({ count: task.count });
        case "daily":
            return m.today_daily();
        case "learn":
            return m.today_learn({ title: task.title });
        case "browse":
            return m.today_browse();
    }
}

// The home page's "open the app, here's what to do" panel: a streak nudge plus a
// short, prioritised task list (refresh what's fading, the daily, something new) —
// each a one-tap link straight into practice. Reads local state after mount, so it's
// absent from the prerendered shell and appears once the client resolves it.
export function HomeToday() {
    const [tasks, setTasks] = useState<Task[] | null>(null);
    const [streak, setStreak] = useState(0);
    const [playedToday, setPlayedToday] = useState(false);

    useEffect(() => {
        let cancelled = false;
        const history = loadHistory();
        setStreak(currentStreak(history));
        setPlayedToday((history[todayKey(new Date())] ?? 0) > 0);
        Promise.all([loadGradedMastery(), loadGradeCatalogue()]).then(([items, catalogue]) => {
            if (cancelled) {
                return;
            }
            const now = Date.now();
            const prefs = loadPrefs();
            const level = currentGrade(items, prefs.decayMode, now);
            const workingGrade = Math.min(level + 1, MAX_GRADE);
            const mastered = new Set(
                items.filter((i) => i.mastery.learned && !i.mastery.backlog).map((i) => i.id),
            );
            const suggestion = gradeSuggestions(catalogue, workingGrade, mastered, 1)[0] ?? null;
            const dailyDoneToday = loadDailyStreak().last === dailyNumber(todayKey(new Date()));
            setTasks(
                todayTasks({
                    dueIds: dueReviews(items, now, prefs.reviewCap),
                    dailyDoneToday,
                    suggestion: suggestion ? { id: suggestion.id, title: suggestion.title } : null,
                }),
            );
        });
        return () => {
            cancelled = true;
        };
    }, []);

    if (tasks === null) {
        return null;
    }

    return (
        <section className="space-y-3 rounded-xl border border-indigo-200 bg-indigo-50/50 p-5 dark:border-indigo-900 dark:bg-indigo-950/30">
            <div className="flex items-baseline justify-between gap-3">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-indigo-700 dark:text-indigo-300">
                    {m.today_heading()}
                </h2>
                {streak > 0 && (
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                        🔥{" "}
                        {playedToday
                            ? m.today_streak_done({ count: streak })
                            : m.today_streak_keep({ count: streak })}
                    </span>
                )}
            </div>
            <ul className="space-y-2">
                {tasks.map((task) => (
                    <li key={task.key}>
                        <Link
                            to={task.to}
                            className="group flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-3 transition hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-sm dark:border-gray-800 dark:bg-gray-900 dark:hover:border-indigo-700"
                        >
                            <span aria-hidden="true" className="text-xl">
                                {ICON[task.key]}
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
