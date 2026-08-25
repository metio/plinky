// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState } from "react";
import type { History, PracticeSummary } from "../../../core/history";
import { type Scope, SCOPES, scopeDays, scopeSummary } from "../../../core/statsScope";
import { m } from "../../paraglide/messages.js";
import { SegmentedControl } from "../ui/segmentedControl";
import { FeatureBoundary } from "./featureBoundary";
import { PracticeReport } from "./practiceReport";
import { ScopeTile } from "./scopeTile";
import { WeekChart } from "./weekChart";

const SCOPE_LABEL: Record<Scope, () => string> = {
    week: () => m.scope_week(),
    month: () => m.scope_month(),
    year: () => m.scope_year(),
    all: () => m.scope_all(),
};

// The answer to "am I getting better?": one dial, and every figure that depends on which
// period you pick.
//
// It draws no heading of its own. The question above it is the heading, and a panel that
// restated its name under one was how the page came to read as a stack of sections rather
// than a set of answers.
//
// Membership is decided by one test: does this number change when the dial moves? Where
// your time went and the notes you are slowest to find do not — they are about how you
// play rather than when — so they answer a different question and live under it.
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
        <div className="space-y-6">
            <SegmentedControl
                label={m.scope_label()}
                value={scope}
                onChange={setScope}
                options={SCOPES.map((id) => ({ id, label: SCOPE_LABEL[id]() }))}
            />

            {everPlayed && (
                <ScopeTile scope={scope} summary={scopeSummary(history, scope, now)} now={now} />
            )}

            {/* The seven bars answer "which days this week", which is a question only the
                week has. Over a month or a year the report's own grid says it better, and
                seven bars would be a chart of the wrong seven days. */}
            {scope === "week" && summary && (
                <FeatureBoundary feature="WeekChart">
                    <WeekChart recent={summary.recent} />
                </FeatureBoundary>
            )}

            <FeatureBoundary feature="PracticeReport">
                {/* days is null only for all time, where the report shows everything — a
                    century of days is every day anybody has. */}
                <PracticeReport
                    pieceTitle={pieceTitle}
                    now={now}
                    days={days ?? 36_500}
                    headed={false}
                />
            </FeatureBoundary>
        </div>
    );
}
