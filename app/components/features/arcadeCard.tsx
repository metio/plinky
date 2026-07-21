// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useEffect, useState } from "react";
import { arcadeConfig, currentArcadeLevel } from "../../../core/arcade";
import { buildExerciseId } from "../../../core/exerciseGen";
import { useMasteryStore } from "../../contexts/services";
import { m } from "../../paraglide/messages.js";
import { LocalizedLink as Link } from "../ui/localizedLink";

// The endless sight-reading arcade's home-page entry: your current rung and one tap into
// it. The rung is the first arcade exercise you haven't cleared — read from the mastery
// the play surface already records — so clearing a level on /play and returning here
// advances it with no bespoke loop. Resolved after mount (mastery is client-only), so it
// is absent from the prerendered shell and appears once the client reads local state.
export function ArcadeCard() {
    const mastery = useMasteryStore();
    const [level, setLevel] = useState<number | null>(null);

    useEffect(() => {
        const compute = () =>
            setLevel(
                currentArcadeLevel(
                    (lv) => mastery.load(buildExerciseId(arcadeConfig(lv)))?.learned === true,
                ),
            );
        compute();
        // Recompute when a level is cleared, so returning from a run shows the next rung.
        return mastery.subscribe(compute);
    }, [mastery]);

    if (level === null) {
        return null;
    }
    const id = buildExerciseId(arcadeConfig(level));

    return (
        <section className="space-y-3 rounded-xl border border-fuchsia-200 bg-gradient-to-br from-fuchsia-50 to-indigo-50 p-5 dark:border-fuchsia-900 dark:from-fuchsia-950/40 dark:to-indigo-950/40">
            <h2 className="font-semibold text-fuchsia-900 text-lg dark:text-fuchsia-100">
                {m.arcade_title()}
            </h2>
            <p className="text-gray-600 text-sm dark:text-gray-400">{m.arcade_blurb()}</p>
            <Link
                to={`/play/${id}`}
                className="inline-block rounded-lg bg-fuchsia-600 px-4 py-2 font-medium text-sm text-white transition hover:bg-fuchsia-500"
            >
                {m.arcade_play({ level })}
            </Link>
        </section>
    );
}
