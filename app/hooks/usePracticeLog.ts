// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useMemo, useSyncExternalStore } from "react";
import { todayKey } from "../../core/daily";
import { shiftDay } from "../../core/dateKey";
import {
    type PracticeLog,
    type PracticeReport,
    RANGE_DAYS,
    type RangeKey,
    summarizeRange,
} from "../../core/practiceSession";
import { usePracticeLogStore } from "../contexts/services";

// Subscribe a component to the practice diary, so a finished run anywhere in the
// app refreshes the report without a reload. Null on the server, where there is
// no stored log — the same shape usePracticeSummary uses, so the You page can wait
// for both together and paint once.
export function usePracticeLog(): PracticeLog | null {
    const store = usePracticeLogStore();
    return useSyncExternalStore(store.subscribe, store.load, () => null);
}

// The log rolled up over a window ending today. The window is anchored to the
// render's clock, so a report left open overnight rolls onto the new day.
export function usePracticeReport(
    range: RangeKey,
    log: PracticeLog | null,
    // The day the window ends on. Injected so a story or a test pins it — the panel is
    // a calendar, and one drawn from the wall clock renders differently every day.
    now: Date,
): PracticeReport | null {
    return useMemo(() => {
        if (!log) {
            return null;
        }
        const to = todayKey(now);
        // Inclusive of both ends, so "7 days" draws seven cells and not eight.
        return summarizeRange(log, shiftDay(to, -(RANGE_DAYS[range] - 1)), to);
    }, [log, range, now]);
}
