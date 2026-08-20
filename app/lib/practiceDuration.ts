// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { m } from "../paraglide/messages.js";

// A span of practice, in the unit the question is asked in. Two panels count the same
// minutes — the report and the repertoire list — and a reader comparing them should not
// have to notice that one says "90 minutes" where the other says "1 h 30".
export function practiceDuration(ms: number): string {
    const totalMinutes = Math.round(ms / 60_000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return hours > 0 ? m.practice_hm({ hours, minutes }) : m.practice_m({ minutes });
}
