// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import {
    type BadgeMarks,
    NO_BADGE_MARKS,
    normalizeBadgeMarks,
    raiseBadgeMarks,
} from "../../core/achievements";
import type { KeyValueStore } from "../ports/keyValueStore";
import { createJsonStore, mergeSubscribe, parseJson } from "./jsonStore";

// The once-only milestone gates: the highest grade already celebrated (so
// reaching it again is silent) and whether the one-time flawless-run card has
// fired. The judgements themselves (what counts as a first S, a flawless run)
// live in core/milestones. Beside them, the badge marks: the best star tier and
// ear mastery ever shown, kept so a shelved piece cannot take a badge back.

const REACHED_GRADE_KEY = "plinky:reached-grade";
const FLAWLESS_KEY = "plinky:flawless-done";
const BADGE_MARKS_KEY = "plinky:badge-marks";

export type MilestonesStore = {
    reachedGrade(): number;
    // Raise the celebrated grade to at least `grade`; false when the write is
    // refused (the celebration may then repeat — annoying, never wrong).
    recordReachedGrade(grade: number): boolean;
    flawlessDone(): boolean;
    recordFlawless(): boolean;
    badgeMarks(): BadgeMarks;
    // Raise the kept badge marks to at least `seen`. Writes only when something is
    // new; false when that write is refused, and the badge then rests on the
    // mastery alone until a later write lands.
    recordBadgeMarks(seen: BadgeMarks): boolean;
    subscribe(onChange: () => void): () => void;
};

export function createMilestonesStore(kv: KeyValueStore): MilestonesStore {
    const reached = createJsonStore<number>(kv, REACHED_GRADE_KEY, (raw) =>
        parseJson(raw, 0, (parsed) =>
            typeof parsed === "number" && Number.isFinite(parsed) ? parsed : 0,
        ),
    );
    const flawless = createJsonStore<boolean>(kv, FLAWLESS_KEY, (raw) =>
        parseJson(raw, false, (parsed) => parsed === true),
    );
    const marks = createJsonStore<BadgeMarks>(kv, BADGE_MARKS_KEY, (raw) =>
        parseJson(raw, NO_BADGE_MARKS, normalizeBadgeMarks),
    );

    return {
        reachedGrade: reached.load,
        recordReachedGrade: (grade) => reached.save(Math.max(reached.load(), grade)),
        flawlessDone: flawless.load,
        recordFlawless: () => flawless.save(true),
        badgeMarks: marks.load,
        recordBadgeMarks: (seen) => {
            const kept = marks.load();
            const next = raiseBadgeMarks(kept, seen);
            return next === kept || marks.save(next);
        },
        subscribe: mergeSubscribe(reached.subscribe, flawless.subscribe, marks.subscribe),
    };
}
