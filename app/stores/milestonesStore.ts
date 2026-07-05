// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { KeyValueStore } from "../ports/keyValueStore";
import { createJsonStore } from "./jsonStore";

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
    const reached = createJsonStore<number>(kv, REACHED_GRADE_KEY, (raw) => {
        try {
            const parsed = JSON.parse(raw ?? "0");
            return typeof parsed === "number" && Number.isFinite(parsed) ? parsed : 0;
        } catch {
            return 0;
        }
    });
    const flawless = createJsonStore<boolean>(kv, FLAWLESS_KEY, (raw) => {
        try {
            return JSON.parse(raw ?? "false") === true;
        } catch {
            return false;
        }
    });

    return {
        reachedGrade: reached.load,
        recordReachedGrade: (grade) => reached.save(Math.max(reached.load(), grade)),
        flawlessDone: flawless.load,
        recordFlawless: () => flawless.save(true),
        subscribe(onChange) {
            const offReached = reached.subscribe(onChange);
            const offFlawless = flawless.subscribe(onChange);
            return () => {
                offReached();
                offFlawless();
            };
        },
    };
}
