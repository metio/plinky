// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { m } from "../../paraglide/messages.js";
import { Show } from "./conditional";

// The headline card: which grade you're at, the skill rating beside it, and the
// crossed-swords badge when the opt-in competitive decay is on.
export function YouStanding({
    level,
    skill,
    competitive,
}: {
    level: number;
    skill: number;
    competitive: boolean;
}) {
    return (
        <div className="flex items-center justify-between gap-3 rounded-md border border-gray-200 p-4 dark:border-gray-800">
            <span className="flex items-center gap-3">
                <span aria-hidden="true" className="text-4xl">
                    🎓
                </span>
                <span className="text-2xl font-bold">
                    {level === 0 ? m.grades_not_started() : m.grades_current({ level })}
                </span>
            </span>
            <span className="flex flex-col items-end gap-0.5 text-right text-sm text-gray-600 dark:text-gray-400">
                <span title={m.grades_skill_help()}>{m.grades_skill({ rating: skill })}</span>
                <Show when={competitive}>
                    <span
                        title={m.grades_competitive_help()}
                        className="font-medium text-amber-700 dark:text-amber-400"
                    >
                        ⚔️ {m.grades_competitive()}
                    </span>
                </Show>
            </span>
        </div>
    );
}

function Stat({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-md border border-gray-200 p-4 dark:border-gray-800">
            <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                {label}
            </div>
            <div className="font-mono text-3xl tabular-nums">{value}</div>
        </div>
    );
}

// The two lifetime activity tiles under the standing card.
export function ActivityStats({
    daysPracticed,
    totalNotes,
}: {
    daysPracticed: number;
    totalNotes: number;
}) {
    return (
        <div className="grid grid-cols-2 gap-4">
            <Stat label={m.progress_days_practiced()} value={String(daysPracticed)} />
            <Stat label={m.progress_notes_played()} value={String(totalNotes)} />
        </div>
    );
}
