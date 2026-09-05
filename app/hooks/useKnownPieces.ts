// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useMemo, useState } from "react";
import { encodeIncipit, readIncipit } from "../../core/incipit";
import { useServices } from "../contexts/services";
import { loadCatalog } from "../lib/catalog";
import { useAsyncEffect } from "./useAsyncEffect";

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
    // The piece's opening bars, encoded, where the catalogue carries them — so a list
    // of pieces can draw each one without asking the network for anything. Undefined
    // for a piece with no mark, which a caller shows as a plain row.
    incipitOf(id: string): string | undefined;
};

export function useKnownPieces(): KnownPieces {
    const { store, songs, exercises, xml } = useServices();
    const [titles, setTitles] = useState<Map<string, string> | null>(null);
    const [marks, setMarks] = useState<Map<string, string>>(new Map());
    useAsyncEffect(
        (alive) => {
            Promise.all([exercises.manifest(), songs.manifest()]).then(
                ([exerciseList, songList]) => {
                    if (!alive()) {
                        return;
                    }
                    // A failed fetch (null) is not an empty catalogue: the set stays
                    // indeterminate, so an offline moment can never mark real pieces
                    // missing — and never offers a prune that would delete them.
                    if (exerciseList === null || songList === null) {
                        return;
                    }
                    const map = new Map<string, string>();
                    const found = new Map<string, string>();
                    const local = loadCatalog(store);
                    for (const piece of [...local, ...exerciseList, ...songList]) {
                        if (!map.has(piece.id)) {
                            map.set(piece.id, piece.title);
                        }
                        // The catalogue bakes a mark per piece (dev/bake-incipits); an exercise
                        // manifest carries none, and a local score has its notation right here,
                        // so it is read rather than looked up.
                        const baked = "incipit" in piece ? piece.incipit : undefined;
                        if (typeof baked === "string" && !found.has(piece.id)) {
                            found.set(piece.id, baked);
                        }
                    }
                    for (const score of local) {
                        if (found.has(score.id)) {
                            continue;
                        }
                        const opening = readIncipit(xml, score.xml);
                        if (opening) {
                            found.set(score.id, encodeIncipit(opening));
                        }
                    }
                    setTitles(map);
                    setMarks(found);
                },
            );
        },
        [store, songs, exercises, xml],
    );
    return useMemo(
        () => ({
            ready: titles !== null,
            isMissing: (id: string) => titles !== null && !titles.has(id),
            titleOf: (id: string) => titles?.get(id) ?? null,
            incipitOf: (id: string) => marks.get(id),
        }),
        [titles, marks],
    );
}
