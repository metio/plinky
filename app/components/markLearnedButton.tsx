// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useMastery } from "../hooks/useMastery";
import { markLearned } from "../lib/mastery";
import { writeMastery } from "../lib/masteryStore";
import { m } from "../paraglide/messages.js";
import { IconButton } from "./button";
import { CheckIcon } from "./icons";

// A self-contained "mark this piece learned" control: it reads the piece's mastery
// from the shared store and hides once learned, and writing back through the store
// re-renders every other view of that mastery — the score's badge, the grade badge —
// in step. Needs only the score id, so any page can place it without wiring up the
// ScoreViewer.
export function MarkLearnedButton({ id }: { id: string }) {
    const mastery = useMastery(id);
    if (mastery?.learned) {
        return null;
    }
    return (
        <IconButton
            variant="ghost"
            onClick={() => writeMastery(id, markLearned(mastery, Date.now()))}
            label={m.mastery_mark_learned()}
            className="text-green-600 dark:text-green-400"
        >
            <CheckIcon />
        </IconButton>
    );
}
