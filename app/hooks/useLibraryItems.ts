// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useCallback, useEffect, useMemo, useState } from "react";
import { assignmentsReferencing } from "../../core/assignment";
import { type LibraryItem, libraryOrder } from "../../core/library";
import type { Mastery } from "../../core/mastery";
import { gradeOf, rawDifficulty } from "../../core/scoreDifficulty";
import { useServices } from "../contexts/services";
import { loadCatalog, removeUserScore } from "../lib/catalog";

// The library's combined catalogue: locally saved scores, the bundled/generated
// exercises, and the deep song catalogue, as one flat item list plus the mastery
// map the due-filtering reads. Local scores render first; the exercise and song
// manifests load over the network. A failed manifest (null) lists nothing for
// now — the library is display only, so the gap heals on the next visit.
export function useLibraryItems() {
    const services = useServices();
    const [local, setLocal] = useState<LibraryItem[]>([]);
    const [exercises, setExercises] = useState<LibraryItem[]>([]);
    const [songs, setSongs] = useState<LibraryItem[]>([]);
    const [mastery, setMastery] = useState<Record<string, Mastery>>({});
    const [loaded, setLoaded] = useState(false);

    const reloadLocal = useCallback(() => {
        setLocal(
            loadCatalog(services.store).map((score) => ({
                id: score.id,
                title: score.title,
                composer: score.composer,
                grade: gradeOf(services.xml, score.id, score.xml),
                // Measured like every other row, so the bundled demos take their real
                // place among the gentlest of grade 1 rather than falling to the end of
                // it for want of a number.
                cost: rawDifficulty(services.xml, score.xml),
                removable: !score.bundled,
                kind: "song" as const,
            })),
        );
    }, [services.xml, services.store]);

    useEffect(() => {
        reloadLocal();
        const map: Record<string, Mastery> = {};
        for (const { id, value } of services.mastery.loadAll()) {
            map[id] = value;
        }
        setMastery(map);
        Promise.all([services.exercises.manifest(), services.songs.manifest()]).then(
            ([exerciseList, manifest]) => {
                setExercises(
                    (exerciseList ?? []).map((exercise) => ({
                        id: exercise.id,
                        title: exercise.title,
                        composer: exercise.composer ?? "",
                        grade: exercise.grade,
                        cost: exercise.cost,
                        ...(exercise.incipit ? { incipit: exercise.incipit } : {}),
                        removable: false,
                        kind: exercise.kind,
                    })),
                );
                setSongs(
                    (manifest ?? []).map((song) => ({
                        id: song.id,
                        title: song.title,
                        composer: song.composer,
                        grade: song.grade,
                        cost: song.cost,
                        // Drawn in the row: the catalogue carries one per piece, so a
                        // list of music can look like music without fetching anything.
                        ...(song.incipit ? { incipit: song.incipit } : {}),
                        removable: false,
                        kind: "song" as const,
                    })),
                );
                setLoaded(true);
            },
        );
    }, [reloadLocal, services.mastery, services.songs.manifest, services.exercises.manifest]);

    // Gentlest first within each grade. Both manifests arrive in that order and
    // concatenating them throws it away, which put a hundred and forty scales and studies
    // in front of every piece of music on the shelf.
    const items = useMemo(
        () => libraryOrder([...local, ...exercises, ...songs]),
        [local, exercises, songs],
    );

    const remove = useCallback(
        (id: string) => {
            removeUserScore(services.store, id);
            reloadLocal();
        },
        [services.store, reloadLocal],
    );

    // How many saved assignments still reference a score — the delete confirm
    // names this blast radius, and those steps then read as missing on the
    // assignments page.
    const assignmentsUsing = useCallback(
        (id: string) => assignmentsReferencing(services.assignments.list(), id),
        [services.assignments],
    );

    return { items, mastery, loaded, remove, assignmentsUsing };
}
