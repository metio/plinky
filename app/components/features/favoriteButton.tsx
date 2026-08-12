// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useFavoritesStore } from "../../contexts/services";
import { useFavorites } from "../../hooks/useFavorites";
import { m } from "../../paraglide/messages.js";
import { IconButton } from "../ui/button";
import { StarIcon } from "../ui/icons";

// A self-contained "is this one of mine?" star. Starring is how a piece you keep coming
// back to becomes findable again — the library filters by it — and until now the only
// place to do it was that list, which meant leaving the piece you were playing to go and
// mark it. It reads the starred set from the shared store, so the star is filled the
// moment it is set anywhere, and writing back re-renders the library in step.
//
// The same filled-or-outline shape the library row uses, so the control means the same
// thing in both places. Needs only the score id, so any page can place it.
export function FavoriteButton({ id }: { id: string }) {
    const favoritesStore = useFavoritesStore();
    const starred = useFavorites().has(id);
    return (
        <IconButton
            variant="plain"
            aria-pressed={starred}
            onClick={() => favoritesStore.toggle(id)}
            label={starred ? m.scores_unfavorite() : m.scores_favorite()}
            className={starred ? "text-warn" : "text-faint"}
        >
            <StarIcon filled={starred} />
        </IconButton>
    );
}
