// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useEffect, useState } from "react";
import { useServices } from "../contexts/services";
import { resolveScore, type Score } from "../lib/catalog";

// Resolve a score id across every source, the way the play page does. Bundled and
// user scores resolve synchronously from local storage; exercises and songs fetch
// their MusicXML on demand. Returns `undefined` while loading, `null` when no such
// score exists, and "unavailable" when a fetch failed and the answer is unknown —
// a valid piece behind a flaky network must not read as nonexistent. Bumping
// `attempt` re-resolves (a failed manifest is never cached, so a retry can
// succeed); a new id re-resolves and discards a stale in-flight fetch.
export function useScore(scoreId: string, attempt = 0): Score | null | undefined | "unavailable" {
    const { songs, exercises, store } = useServices();
    const [score, setScore] = useState<Score | null | undefined | "unavailable">(undefined);
    // biome-ignore lint/correctness/useExhaustiveDependencies: `attempt` is a hook argument; a bump must re-run the resolution
    useEffect(() => {
        const local = resolveScore(store, scoreId);
        if (local) {
            setScore(local);
            return;
        }
        setScore(undefined);
        let cancelled = false;
        (async () => {
            const fromExercises = await exercises.resolve(scoreId);
            if (fromExercises !== null && fromExercises !== "unavailable") {
                if (!cancelled) {
                    setScore(fromExercises);
                }
                return;
            }
            const fromSongs = await songs.resolve(scoreId);
            const found =
                fromSongs !== null && fromSongs !== "unavailable"
                    ? fromSongs
                    : fromExercises === "unavailable" || fromSongs === "unavailable"
                      ? ("unavailable" as const)
                      : null;
            if (!cancelled) {
                setScore(found);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [scoreId, songs, exercises, store, attempt]);
    return score;
}
