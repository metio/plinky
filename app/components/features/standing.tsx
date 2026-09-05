// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { m } from "../../paraglide/messages.js";
import { Show } from "./conditional";
import { StatTile } from "../ui/statTile";

// The headline card: which grade you're at, the skill rating beside it, and the
// crossed-swords badge when the opt-in competitive decay is on.
export function Standing({
    level,
    skill,
    competitive,
}: {
    level: number;
    skill: number;
    competitive: boolean;
}) {
    return (
        <div className="flex items-center justify-between gap-3 rounded-md border border-line p-4">
            <span className="flex items-center gap-3">
                <span aria-hidden="true" className="text-4xl">
                    🎓
                </span>
                <span className="text-2xl font-bold">
                    {level === 0 ? m.grades_not_started() : m.grades_current({ level })}
                </span>
            </span>
            <span className="flex flex-col items-end gap-0.5 text-right text-sm text-muted">
                <span>{m.grades_skill({ rating: skill })}</span>
                <Show when={competitive}>
                    <span title={m.grades_competitive_help()} className="font-medium text-warn">
                        ⚔️ {m.grades_competitive()}
                    </span>
                </Show>
            </span>
        </div>
    );
}

// What the two numbers above actually mean. They used to be explained in a `title`, which
// is a tooltip nobody on a touch screen can open and most readers never hover — so the one
// page whose whole subject is those two figures never said what either of them was. The
// grade line repeats the roadmap's promise on purpose: this is where a reader wonders
// whether a number is holding them back, and the answer is that nothing is locked.
export function StandingKey() {
    return (
        <dl className="space-y-2 text-sm">
            <div>
                <dt className="inline font-medium text-ink">{m.stats_grade_label()}</dt>{" "}
                <dd className="inline text-muted">{m.stats_grade_help()}</dd>
            </div>
            <div>
                <dt className="inline font-medium text-ink">{m.stats_skill_label()}</dt>{" "}
                <dd className="inline text-muted">{m.grades_skill_help()}</dd>
            </div>
        </dl>
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
            <StatTile label={m.progress_days_practiced()} value={daysPracticed} />
            <StatTile label={m.progress_notes_played()} value={totalNotes} />
        </div>
    );
}
