// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { IntervalId } from "../../core/theory";
import { m } from "../paraglide/messages.js";

// core/theory names things with identifiers so it can stay pure and language-neutral.
// This is where an id becomes words — the one edge that knows both vocabularies. The
// tables are exhaustive by type, so adding an interval to core won't compile until it
// has a translated name.

export const INTERVAL_NAMES: Record<IntervalId, () => string> = {
    unison: m.theory_interval_unison,
    "minor-second": m.theory_interval_minor_second,
    "major-second": m.theory_interval_major_second,
    "minor-third": m.theory_interval_minor_third,
    "major-third": m.theory_interval_major_third,
    "perfect-fourth": m.theory_interval_perfect_fourth,
    tritone: m.theory_interval_tritone,
    "perfect-fifth": m.theory_interval_perfect_fifth,
    "minor-sixth": m.theory_interval_minor_sixth,
    "major-sixth": m.theory_interval_major_sixth,
    "minor-seventh": m.theory_interval_minor_seventh,
    "major-seventh": m.theory_interval_major_seventh,
    octave: m.theory_interval_octave,
};

export function intervalName(interval: IntervalId): string {
    return INTERVAL_NAMES[interval]();
}
