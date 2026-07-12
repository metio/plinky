// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { PracticeSummary } from "../../../core/history";
import { m } from "../../paraglide/messages.js";

// The 7-day retrospective: one bar per day, scaled to the busiest day so a
// quiet week still shows its shape.
export function WeekChart({ recent }: { recent: PracticeSummary["recent"] }) {
    const max = Math.max(1, ...recent.map((day) => day.notes));
    return (
        <div>
            <h2 className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                {m.progress_last_7_days()}
            </h2>
            <div className="flex h-32 items-end gap-2">
                {recent.map((day) => (
                    <div
                        key={day.date}
                        className="flex h-full flex-1 flex-col items-center justify-end gap-1"
                        title={
                            day.notes === 1
                                ? m.progress_notes_one({ count: day.notes })
                                : m.progress_notes_other({ count: day.notes })
                        }
                    >
                        <div
                            className="w-full rounded-t bg-indigo-500"
                            style={{ height: `${Math.round((day.notes / max) * 100)}%` }}
                        />
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                            {day.date.slice(5)}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}
