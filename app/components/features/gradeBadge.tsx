// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState } from "react";
import { currentGrade, loadGradedMastery, skillRating } from "../../lib/gradeProgress";
import { usePrefsStore, useServices } from "../../contexts/services";
import { m } from "../../paraglide/messages.js";
import { LocalizedLink as Link } from "../ui/localizedLink";
import { useAsyncEffect } from "../../hooks/useAsyncEffect";

// The current grade beside the logo, and the way to reach the page that explains it.
// Derived from how much of each grade's pool the player has mastered under their chosen
// decay mode, so it resolves after mount (nothing during prerender, matching the first
// client render) and refreshes on the practice event.
//
// It appears only once there is something to report. A device that has mastered nothing
// showed a greyed cap reading 0 beside a skill of 0 — the first thing a first visit met,
// saying only that they had not started — and the navigation names You anyway, so
// nothing is lost by waiting until the badge has news.
export function GradeBadge() {
    const [level, setLevel] = useState<number | null>(null);
    const [skill, setSkill] = useState(0);
    const [competitive, setCompetitive] = useState(false);
    const prefsStore = usePrefsStore();
    const services = useServices();

    useAsyncEffect(
        (alive) => {
            const read = () => {
                loadGradedMastery(services.mastery, services).then((items) => {
                    if (alive()) {
                        const mode = prefsStore.load().decayMode;
                        const now = Date.now();
                        setLevel(currentGrade(items));
                        setSkill(skillRating(items, mode, now));
                        setCompetitive(mode === "competitive");
                    }
                });
            };
            read();
            // A finished run saves mastery through the store; both the grade and the
            // decay-mode mark also shift when preferences change.
            const unsubscribeMastery = services.mastery.subscribe(read);
            // Of everything in the preferences this badge reads one field, and it sits in the
            // app shell — so subscribing to the lot meant re-reading the ladder on every
            // switch flipped anywhere in the app, including every reading aid toggled from
            // the play surface mid-piece.
            let mode = prefsStore.load().decayMode;
            const unsubscribePrefs = prefsStore.subscribe(() => {
                const next = prefsStore.load().decayMode;
                if (next === mode) {
                    return;
                }
                mode = next;
                read();
            });
            return () => {
                unsubscribeMastery();
                unsubscribePrefs();
            };
        },
        [prefsStore, services],
    );

    // Shown at every standing, including none: it is the way to the stats page from
    // anywhere, and a door that appears only once you have earned something is a door a
    // new player cannot find. `null` is the tick before the store has been read — not a
    // standing of zero — so it still renders nothing rather than flashing a grade 0 that
    // is about to become a 3.
    if (level === null) {
        return null;
    }
    return <GradeBadgeView level={level} skill={skill} competitive={competitive} />;
}

// The badge itself, from plain values: what it looks like at any standing, without a
// store or a catalogue behind it.
export function GradeBadgeView({
    level,
    skill,
    competitive,
}: {
    level: number;
    skill: number;
    competitive: boolean;
}) {
    const earned = level > 0;
    return (
        <Link
            to="/stats"
            aria-label={
                competitive ? m.grade_label_competitive({ level }) : m.grade_label({ level })
            }
            className={`flex items-center gap-1 text-sm font-semibold ${
                earned ? "text-accent" : "text-muted"
            }`}
        >
            <span aria-hidden="true" className={earned ? "" : "grayscale"}>
                🎓
            </span>
            <span className="tabular-nums">{level}</span>
            {competitive && <span aria-hidden="true">⚔️</span>}
            <span aria-hidden="true" className="ml-0.5 text-xs font-medium text-muted">
                ⚡{skill}
            </span>
        </Link>
    );
}
