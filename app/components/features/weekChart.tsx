// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { DaySeries } from "../../../core/statsScope";
import { m } from "../../paraglide/messages.js";

// This week, one bar per day from Monday to today, scaled to the busiest day so a quiet
// week still shows its shape. The same calendar week the tile above it reports on, so
// the bars and the figures never describe two different windows.
export function WeekChart({ days }: { days: DaySeries }) {
    const max = Math.max(1, ...days.map((day) => day.notes));
    return (
        <div>
            <h2 className="mb-2 text-sm font-medium text-body">{m.scope_week_name()}</h2>
            <div className="flex h-32 items-end gap-2">
                {days.map((day) => (
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
                            className="w-full rounded-t bg-chart-peak"
                            style={{ height: `${Math.round((day.notes / max) * 100)}%` }}
                        />
                        <span className="text-xs text-muted">{day.date.slice(5)}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
