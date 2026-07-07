// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { setBacklog } from "../../../core/mastery";
import { useMasteryStore } from "../../contexts/services";
import { useMastery } from "../../hooks/useMastery";
import { m } from "../../paraglide/messages.js";
import { IconButton } from "../ui/button";
import { ArchiveIcon } from "../ui/icons";

// Shelve a piece you're not working on right now (or bring it back). A per-piece status
// like the learned toggle beside it, so it lives in the play-page header rather than
// under the score. Only a learned piece can be shelved, so it renders nothing until then.
// Self-contained on the shared mastery store, so a change re-renders every other view in
// step and any page can drop it in with just the score id.
export function BacklogButton({ id }: { id: string }) {
    const masteryStore = useMasteryStore();
    const mastery = useMastery(id);
    if (!mastery?.learned) {
        return null;
    }
    const backlogged = mastery.backlog ?? false;
    return (
        <IconButton
            variant="plain"
            aria-pressed={backlogged}
            onClick={() => masteryStore.save(id, setBacklog(mastery, !backlogged, Date.now()))}
            label={backlogged ? m.mastery_resume() : m.mastery_backlog()}
            className={
                backlogged
                    ? "text-indigo-600 dark:text-indigo-400"
                    : "text-gray-400 dark:text-gray-500"
            }
        >
            <ArchiveIcon filled={backlogged} />
        </IconButton>
    );
}
