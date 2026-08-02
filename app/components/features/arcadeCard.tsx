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
        <section className="space-y-3 rounded-xl border border-ghost-line bg-gradient-to-br from-ghost-surface to-accent-surface p-5 dark:from-ghost-surface/40 dark:to-accent-surface/40">
            <h2 className="font-semibold text-ghost-ink text-lg">{m.arcade_title()}</h2>
            <p className="text-muted text-sm">{m.arcade_blurb()}</p>
            <Link
                to={`/play/${id}`}
                className="inline-block rounded-lg bg-ghost px-4 py-2 font-medium text-sm text-white transition hover:bg-ghost"
            >
                {m.arcade_play({ level })}
            </Link>
        </section>
    );
}
