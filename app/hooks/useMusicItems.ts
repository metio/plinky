// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useCallback, useEffect, useMemo, useState } from "react";
import { assignmentsReferencing } from "../../core/assignment";
import { type MusicItem, musicOrder } from "../../core/music";
import type { Mastery } from "../../core/mastery";
import { encodeIncipit } from "../../core/incipit";
import { measureScore } from "../../core/scoreDifficulty";
import { useServices } from "../contexts/services";
import { loadCatalog, removeUserScore } from "../lib/catalog";

export function useMusicItems() {
    const services = useServices();
    const [local, setLocal] = useState<MusicItem[]>([]);
    const [exercises, setExercises] = useState<MusicItem[]>([]);
    const [songs, setSongs] = useState<MusicItem[]>([]);
    const [mastery, setMastery] = useState<Record<string, Mastery>>({});
    const [loaded, setLoaded] = useState(false);

    const reloadLocal = useCallback(() => {
        setLocal(
            loadCatalog(services.store).map((score) => {
                // One read of the score for all three: the grade, the cost that places
                // it among its grade, and the opening bars. Catalogue songs carry all of
                // these baked from the import manifest; everything held on the device —
                // the two bundled demos and anything you brought yourself — is measured
                // here, so the pieces a player meets first take their real place among
                // the gentlest of grade 1 rather than falling to the end of it for want
                // of a number, and carry opening bars like every other row.
                const measure = measureScore(services.xml, score.id, score.xml);
                return {
                    id: score.id,
                    title: score.title,
                    composer: score.composer,
                    grade: measure.grade,
                    cost: measure.cost,
                    ...(measure.incipit ? { incipit: encodeIncipit(measure.incipit) } : {}),
                    removable: !score.bundled,
                    kind: "song" as const,
                };
            }),
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
                        // Measured at bake time, and only where a reduction reaches
                        // somewhere easier — so a row either has a way in to offer or says
                        // nothing about one.
                        ...(song.reach ? { reach: song.reach } : {}),
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
        () => musicOrder([...local, ...exercises, ...songs]),
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
