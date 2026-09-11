// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { Deadline } from "../../core/repertoire";
import { m } from "../paraglide/messages.js";

// How a date the player is working toward reads beside a piece or an assignment. The day
// itself is named as today: counting down to it would say "0 days away" on the very day.
export function deadlineText(deadline: Deadline): string {
    if (deadline.passed) {
        return m.repertoire_date_passed({ date: deadline.date });
    }
    if (deadline.daysLeft === 0) {
        return m.repertoire_due_today({ date: deadline.date });
    }
    return m.repertoire_days_left({ date: deadline.date, count: deadline.daysLeft });
}
