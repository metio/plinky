// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useEffect, useState } from "react";
import { Link } from "react-router";
import { loadCatalog, loadCurriculums } from "../lib/catalog";
import { type CurriculumGroup, groupByCurriculum } from "../lib/curriculums";
import { routeMeta } from "../lib/site";
import { m } from "../paraglide/messages.js";
import type { Route } from "./+types/curriculums";

export function meta(_args: Route.MetaArgs) {
    return routeMeta("Curriculums", "Your scores, grouped by the curriculums you have imported");
}

const SCORE_LINK =
    "rounded-md bg-indigo-50 px-3 py-1.5 text-sm font-medium text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950 dark:text-indigo-300 dark:hover:bg-indigo-900";

export default function CurriculumsRoute() {
    const [groups, setGroups] = useState<CurriculumGroup[]>([]);
    useEffect(() => {
        const userScores = loadCatalog().filter((score) => !score.bundled);
        setGroups(groupByCurriculum(userScores, loadCurriculums()));
    }, []);

    return (
        <main className="mx-auto max-w-3xl space-y-6 p-6 font-sans">
            <header className="space-y-1">
                <h1 className="text-2xl font-semibold">{m.curriculums_heading()}</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">{m.curriculums_intro()}</p>
            </header>

            {groups.length === 0 && (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                    {m.curriculums_empty_prefix()}{" "}
                    <Link to="/import" className="text-indigo-700 underline dark:text-indigo-300">
                        {m.home_find_to_import()}
                    </Link>
                    .
                </p>
            )}

            {groups.map((group) => (
                <section key={group.curriculum?.id ?? "other"} className="space-y-3">
                    <h2 className="text-lg font-medium">
                        {group.curriculum ? group.curriculum.name : m.curriculums_other()}
                        {group.curriculum?.publisher && (
                            <span className="ml-2 text-sm font-normal text-gray-500 dark:text-gray-400">
                                {group.curriculum.publisher}
                            </span>
                        )}
                    </h2>
                    <ul className="space-y-2">
                        {group.scores.map((score) => (
                            <li
                                key={score.id}
                                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-gray-200 p-3 dark:border-gray-800"
                            >
                                <span className="font-medium">{score.title}</span>
                                <Link to={`/play/${score.id}`} className={SCORE_LINK}>
                                    {m.curriculums_practice()}
                                </Link>
                            </li>
                        ))}
                    </ul>
                </section>
            ))}

            <Link to="/" className="text-sm text-indigo-700 underline dark:text-indigo-300">
                {m.action_back_home()}
            </Link>
        </main>
    );
}
