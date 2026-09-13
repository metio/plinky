// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { m } from "../../paraglide/messages.js";
import { Show } from "./conditional";
import { Folio, FolioFigure, FolioRow, folioIconClasses } from "../ui/folio";
import { GradCapIcon } from "../ui/icons";

// The headline: which grade you're at and the skill rating, each a Folio row, and the
// crossed-swords badge when the opt-in competitive decay is on. The grade is named in
// words ("Grade 3") with the cap in the margin, since a figure beside its own number would
// say it twice; the rating is a bare number, so it takes the margin.
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
        <Folio>
            <FolioRow
                margin={<GradCapIcon className={folioIconClasses} />}
                name={level === 0 ? m.grades_not_started() : m.grades_current({ level })}
                trailing={
                    <Show when={competitive}>
                        <span
                            title={m.grades_competitive_help()}
                            className="text-sm font-medium text-warn"
                        >
                            ⚔️ {m.grades_competitive()}
                        </span>
                    </Show>
                }
            />
            <FolioRow margin={<FolioFigure value={skill} />} name={m.stats_skill_label()} />
        </Folio>
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

// The two lifetime activity figures, each in the margin of its own row.
export function ActivityStats({
    daysPracticed,
    totalNotes,
}: {
    daysPracticed: number;
    totalNotes: number;
}) {
    return (
        <Folio>
            <FolioRow
                margin={<FolioFigure value={daysPracticed} />}
                name={m.progress_days_practiced()}
            />
            <FolioRow
                margin={<FolioFigure value={totalNotes} />}
                name={m.progress_notes_played()}
            />
        </Folio>
    );
}
