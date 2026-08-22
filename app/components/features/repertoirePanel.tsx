// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { todayKey } from "../../../core/daily";
import { practiceHref } from "../../../core/practisable";
import { buildRepertoire, type Stage } from "../../../core/repertoire";
import { setDeadline } from "../../../core/mastery";
import { useMasteryStore } from "../../contexts/services";
import { useStoreVersion } from "../../hooks/useStoreVersion";
import type { GradedMastery } from "../../lib/gradeProgress";
import { m } from "../../paraglide/messages.js";
import { compactFieldClasses, linkClasses, sectionHeadingClasses } from "../ui/classes";
import { LocalizedLink as Link } from "../ui/localizedLink";

// What is on the music stand: the pieces being worked on, where each one has got to,
// and any date it is being worked toward. The grade roadmap answers "what can I
// play"; this answers "what am I working on, and what is coming up" — the question a
// player preparing for a lesson, an exam or a recital actually asks.
//
// The stage is derived from the review interval rather than chosen, so there is
// nothing to keep up to date. The date is the only thing entered by hand, because it
// is the only thing the app cannot know.

const STAGE_LABEL: Record<Stage, () => string> = {
    learning: () => m.repertoire_stage_learning(),
    consolidating: () => m.repertoire_stage_consolidating(),
    polishing: () => m.repertoire_stage_polishing(),
    maintenance: () => m.repertoire_stage_maintenance(),
};

// Enough to see the shape of what is in progress without turning the You page into a
// second library. Everything is still reachable from the library itself.
const LISTED = 12;

export function RepertoirePanel({ items, now }: { items: GradedMastery[]; now: Date }) {
    const store = useMasteryStore();
    // Subscribed rather than read once from the items prop: setting a date writes to
    // the mastery store, and a panel rendering off a snapshot taken when the page
    // loaded would keep showing the old date until a reload. The prop is the
    // fallback, for a piece the store has no entry for.
    useStoreVersion(store.subscribe);
    const today = todayKey(now);
    const masteryOf = (id: string) =>
        store.load(id) ?? items.find((item) => item.id === id)?.mastery ?? null;
    const repertoire = buildRepertoire(items, masteryOf, today, now.getTime()).slice(0, LISTED);

    if (repertoire.length === 0) {
        return null;
    }

    return (
        <section className="space-y-3">
            <div className="space-y-1">
                <h2 className={sectionHeadingClasses}>{m.repertoire_title()}</h2>
                <p className="text-xs text-muted">{m.repertoire_intro()}</p>
            </div>
            <ul className="space-y-2">
                {repertoire.map(({ item, stage, deadline, slipping }) => (
                    <li
                        key={item.id}
                        className="flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-lg border border-line bg-surface p-3"
                    >
                        <Link className={linkClasses} to={practiceHref(item)}>
                            {item.title}
                        </Link>
                        <span className="text-xs text-muted">{STAGE_LABEL[stage]()}</span>
                        {slipping && (
                            <span className="text-xs text-warn-ink">{m.repertoire_slipping()}</span>
                        )}
                        {deadline && (
                            <span className="text-xs text-muted">
                                {deadline.passed
                                    ? m.repertoire_date_passed({ date: deadline.date })
                                    : m.repertoire_days_left({
                                          date: deadline.date,
                                          count: deadline.daysLeft,
                                      })}
                            </span>
                        )}
                        <label className="ml-auto flex items-center gap-2 text-xs text-muted">
                            <span>{m.repertoire_deadline()}</span>
                            <input
                                type="date"
                                value={deadline?.date ?? ""}
                                onChange={(event) =>
                                    store.save(
                                        item.id,
                                        setDeadline(
                                            masteryOf(item.id),
                                            event.target.value,
                                            now.getTime(),
                                        ),
                                    )
                                }
                                className={compactFieldClasses}
                            />
                        </label>
                    </li>
                ))}
            </ul>
        </section>
    );
}
