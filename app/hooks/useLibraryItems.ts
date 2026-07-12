// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useCallback, useEffect, useMemo, useState } from "react";
import { assignmentsReferencing } from "../../core/assignment";
import type { LibraryItem } from "../../core/library";
import type { Mastery } from "../../core/mastery";
import { gradeOf } from "../../core/scoreDifficulty";
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
                        removable: false,
                        kind: "song" as const,
                    })),
                );
                setLoaded(true);
            },
        );
    }, [reloadLocal, services.mastery, services.songs.manifest, services.exercises.manifest]);

    const items = useMemo(() => [...local, ...exercises, ...songs], [local, exercises, songs]);

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
