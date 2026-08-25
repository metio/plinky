// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState } from "react";
import type { History, PracticeSummary } from "../../../core/history";
import { type Scope, SCOPES, scopeDays, scopeSummary } from "../../../core/statsScope";
import { m } from "../../paraglide/messages.js";
import { SegmentedControl } from "../ui/segmentedControl";
import { SettingsSection } from "../ui/settingsSection";
import { FeatureBoundary } from "./featureBoundary";
import { PracticeBalance } from "./practiceBalance";
import { PracticeReport } from "./practiceReport";
import { ScopeTile } from "./scopeTile";
import { SlowNotes } from "./slowNotes";
import { WeekChart } from "./weekChart";

const SCOPE_LABEL: Record<Scope, () => string> = {
    week: () => m.scope_week(),
    month: () => m.scope_month(),
    year: () => m.scope_year(),
    all: () => m.scope_all(),
};

// Everything on the You page that depends on a period, behind the one dial that says which.
//
// The page used to carry six windows at once — a lifetime total, a seven-day chart, the
// report's own week/month/quarter/year control, a balance over the whole log, a calendar
// month card and an unlabelled lifetime fingerprint — scattered from top to foot with
// nothing saying they were the same figures seen differently. Membership of this block is
// decided by a question a reader can feel: is this number about a period, or not?
//
// Month by default, which is the window somebody checking in on themselves means.
export function GoingBlock({
    history,
    summary,
    pieceTitle,
    now,
}: {
    history: History;
    // The seven-day series the week chart draws, already computed for the page.
    summary: PracticeSummary | null;
    pieceTitle: (id: string) => string;
    now: Date;
}) {
    const [scope, setScope] = useState<Scope>("month");
    const days = scopeDays(scope, now);
    // Nothing ever played: the tile would be a pair of zeros in a proud gradient, a frame
    // promising insight it does not have. An empty WINDOW is different and keeps its zeros
    // — "no practice this week" is a real answer — so this asks about all of it.
    const everPlayed = scopeSummary(history, "all", now).totalNotes > 0;
    return (
        <SettingsSection title={m.you_block_going()} hint={m.you_block_going_hint()}>
            <div className="space-y-6">
                <SegmentedControl
                    label={m.scope_label()}
                    value={scope}
                    onChange={setScope}
                    options={SCOPES.map((id) => ({ id, label: SCOPE_LABEL[id]() }))}
                />

                {everPlayed && (
                    <ScopeTile
                        scope={scope}
                        summary={scopeSummary(history, scope, now)}
                        now={now}
                    />
                )}

                {/* The seven bars answer "which days this week", which is a question only
                    the week has. Over a month or a year the report's own grid says it
                    better, and seven bars would be a chart of the wrong seven days. */}
                {scope === "week" && summary && (
                    <FeatureBoundary feature="WeekChart">
                        <WeekChart recent={summary.recent} />
                    </FeatureBoundary>
                )}

                <FeatureBoundary feature="PracticeReport">
                    {/* days is null only for all time, where the report shows everything —
                        a century of days is every day anybody has. */}
                    <PracticeReport pieceTitle={pieceTitle} now={now} days={days ?? 36_500} />
                </FeatureBoundary>

                <FeatureBoundary feature="PracticeBalance">
                    <PracticeBalance pieceTitle={pieceTitle} now={now.getTime()} />
                </FeatureBoundary>

                {/* The note-timing store keeps no dates, so this one cannot follow the
                    dial. It says so and stays where it is true, rather than a schema
                    change invented to make a layout tidy. */}
                {scope === "all" ? (
                    <FeatureBoundary feature="SlowNotes">
                        <SlowNotes />
                    </FeatureBoundary>
                ) : (
                    <p className="text-xs text-muted">{m.you_slow_notes_elsewhere()}</p>
                )}
            </div>
        </SettingsSection>
    );
}
