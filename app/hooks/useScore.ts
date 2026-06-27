// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useEffect, useState } from "react";
import { resolveScore, type Score } from "../lib/catalog";
import { resolveExercise } from "../lib/exercises";
import { resolveSong } from "../lib/songs";

// Resolve a score id across every source, the way the play page does. Bundled and
// user scores resolve synchronously from local storage; exercises and songs fetch
// their MusicXML on demand. Returns `undefined` while loading and `null` when no
// such score exists. A new id re-resolves and discards a stale in-flight fetch.
export function useScore(scoreId: string): Score | null | undefined {
    const [score, setScore] = useState<Score | null | undefined>(undefined);
    useEffect(() => {
        const local = resolveScore(scoreId);
        if (local) {
            setScore(local);
            return;
        }
        setScore(undefined);
        let cancelled = false;
        (async () => {
            const found = (await resolveExercise(scoreId)) ?? (await resolveSong(scoreId));
            if (!cancelled) {
                setScore(found);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [scoreId]);
    return score;
}
