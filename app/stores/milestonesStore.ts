// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { KeyValueStore } from "../ports/keyValueStore";
import { createJsonStore, mergeSubscribe, parseJson } from "./jsonStore";

// The once-only milestone gates: the highest grade already celebrated (so
// reaching it again is silent) and whether the one-time flawless-run card has
// fired. The judgements themselves (what counts as a first S, a flawless run)
// live in core/milestones.

const REACHED_GRADE_KEY = "plinky:reached-grade";
const FLAWLESS_KEY = "plinky:flawless-done";

export type MilestonesStore = {
    reachedGrade(): number;
    // Raise the celebrated grade to at least `grade`; false when the write is
    // refused (the celebration may then repeat — annoying, never wrong).
    recordReachedGrade(grade: number): boolean;
    flawlessDone(): boolean;
    recordFlawless(): boolean;
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

    return {
        reachedGrade: reached.load,
        recordReachedGrade: (grade) => reached.save(Math.max(reached.load(), grade)),
        flawlessDone: flawless.load,
        recordFlawless: () => flawless.save(true),
        subscribe: mergeSubscribe(reached.subscribe, flawless.subscribe),
    };
}
