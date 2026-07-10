// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useEffect, useMemo, useState } from "react";
import { useServices } from "../contexts/services";
import { loadCatalog } from "../lib/catalog";

// The universe of piece ids the play page can resolve — the local catalogue
// (bundled + imported), the exercise manifest and the song manifest — with each
// piece's title for labelling. The manifests arrive over the network, so the set
// is indeterminate at first: `ready` stays false and `isMissing` answers false
// until both have loaded — and stays that way when a fetch fails, since a piece
// must never be called missing while a source is merely unreachable.
export type KnownPieces = {
    ready: boolean;
    isMissing(id: string): boolean;
    titleOf(id: string): string | null;
};

export function useKnownPieces(): KnownPieces {
    const { store, songs, exercises } = useServices();
    const [titles, setTitles] = useState<Map<string, string> | null>(null);
    useEffect(() => {
        let cancelled = false;
        Promise.all([exercises.manifest(), songs.manifest()]).then(([exerciseList, songList]) => {
            if (cancelled) {
                return;
            }
            // A failed fetch (null) is not an empty catalogue: the set stays
            // indeterminate, so an offline moment can never mark real pieces
            // missing — and never offers a prune that would delete them.
            if (exerciseList === null || songList === null) {
                return;
            }
            const map = new Map<string, string>();
            for (const piece of [...loadCatalog(store), ...exerciseList, ...songList]) {
                if (!map.has(piece.id)) {
                    map.set(piece.id, piece.title);
                }
            }
            setTitles(map);
        });
        return () => {
            cancelled = true;
        };
    }, [store, songs, exercises]);
    return useMemo(
        () => ({
            ready: titles !== null,
            isMissing: (id: string) => titles !== null && !titles.has(id),
            titleOf: (id: string) => titles?.get(id) ?? null,
        }),
        [titles],
    );
}
