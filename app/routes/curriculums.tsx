// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useEffect, useState } from "react";
import { Link } from "react-router";
import { type CurriculumGroup, groupByCurriculum } from "../lib/curriculums";
import { routeMeta } from "../lib/site";
import { loadCurriculums, loadUserSongs } from "../lib/songs";
import type { Route } from "./+types/curriculums";

export function meta(_args: Route.MetaArgs) {
    return routeMeta("Curriculums", "Your songs, grouped by the curriculums you have imported");
}

const SONG_LINK =
    "rounded-md bg-indigo-50 px-3 py-1.5 text-sm font-medium text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950 dark:text-indigo-300 dark:hover:bg-indigo-900";

export default function CurriculumsRoute() {
    const [groups, setGroups] = useState<CurriculumGroup[]>([]);
    useEffect(() => {
        setGroups(groupByCurriculum(loadUserSongs(), loadCurriculums()));
    }, []);

    return (
        <main className="mx-auto max-w-3xl space-y-6 p-6 font-sans">
            <header className="space-y-1">
                <h1 className="text-2xl font-semibold">Curriculums</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                    Your songs, grouped by curriculum. Import a curriculum pack in Settings to add a
                    teacher's or school's collection.
                </p>
            </header>

            {groups.length === 0 && (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                    No songs yet.{" "}
                    <Link to="/import" className="text-indigo-700 underline dark:text-indigo-300">
                        Find songs to import
                    </Link>
                    .
                </p>
            )}

            {groups.map((group) => (
                <section key={group.curriculum?.id ?? "other"} className="space-y-3">
                    <h2 className="text-lg font-medium">
                        {group.curriculum ? group.curriculum.name : "Other songs"}
                        {group.curriculum?.publisher && (
                            <span className="ml-2 text-sm font-normal text-gray-400">
                                {group.curriculum.publisher}
                            </span>
                        )}
                    </h2>
                    <ul className="space-y-2">
                        {group.songs.map((song) => (
                            <li
                                key={song.id}
                                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-gray-200 p-3 dark:border-gray-800"
                            >
                                <span className="font-medium">{song.title}</span>
                                <div className="flex gap-2">
                                    <Link to={`/practice/${song.id}`} className={SONG_LINK}>
                                        Practice
                                    </Link>
                                    <Link to={`/loop/${song.id}`} className={SONG_LINK}>
                                        Loop
                                    </Link>
                                </div>
                            </li>
                        ))}
                    </ul>
                </section>
            ))}

            <Link to="/" className="text-sm text-indigo-700 underline dark:text-indigo-300">
                Back home
            </Link>
        </main>
    );
}
