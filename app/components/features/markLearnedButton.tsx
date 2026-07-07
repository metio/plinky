// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { markLearned, unmarkLearned } from "../../../core/mastery";
import { useMasteryStore } from "../../contexts/services";
import { useMastery } from "../../hooks/useMastery";
import { m } from "../../paraglide/messages.js";
import { IconButton } from "../ui/button";
import { CheckIcon } from "../ui/icons";

// A self-contained "is this piece learned?" toggle: it reads the piece's mastery from
// the shared store and shows the state in its colour — a green check once learned, the
// indigo accent while not — so the badge alone tells you where the piece stands and
// clicking it flips the state either way. That colour is the sole learned/not signal on
// the play page, so nothing else need repeat it in text. Writing back through the store
// re-renders every other view of that mastery — the score's badge, the grade badge — in
// step. Needs only the score id, so any page can place it without wiring up the ScoreViewer.
export function MarkLearnedButton({ id }: { id: string }) {
    const masteryStore = useMasteryStore();
    const mastery = useMastery(id);
    const learned = mastery?.learned ?? false;
    return (
        <IconButton
            variant="ghost"
            aria-pressed={learned}
            onClick={() =>
                masteryStore.save(
                    id,
                    learned ? unmarkLearned(mastery, Date.now()) : markLearned(mastery, Date.now()),
                )
            }
            label={learned ? m.mastery_learned() : m.mastery_mark_learned()}
            className={
                learned
                    ? "text-green-600 dark:text-green-400"
                    : "text-indigo-600 dark:text-indigo-400"
            }
        >
            <CheckIcon />
        </IconButton>
    );
}
