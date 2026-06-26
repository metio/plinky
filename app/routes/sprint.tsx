// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useEffect, useState } from "react";
import { LocalizedLink as Link } from "../components/localizedLink";
import { ScoreViewer } from "../components/scoreViewer";
import { generatePhrase } from "../lib/generator";
import { routeMeta } from "../lib/site";
import { m } from "../paraglide/messages.js";
import type { Route } from "./+types/sprint";

export function meta(_args: Route.MetaArgs) {
    return routeMeta("Sight-reading sprint", "Fresh notes every run — sight-read and be graded");
}

const OPTIONS = { bars: 8, beatsPerBar: 4 };

export default function SprintRoute() {
    // A fresh phrase each run; bumping the counter regenerates and remounts the
    // viewer. Generated on the client so the first phrase is not baked at build.
    const [run, setRun] = useState(0);
    const [xml, setXml] = useState<string | null>(null);
    // Add a bass line so the phrase spans both hands, drillable together or one
    // hand at a time through the viewer's hands selector.
    const [twoHands, setTwoHands] = useState(false);

    const regenerate = (hands: boolean) => {
        setXml(generatePhrase({ ...OPTIONS, twoHands: hands }));
        setRun((value) => value + 1);
    };
    useEffect(() => {
        setXml(generatePhrase({ ...OPTIONS, twoHands: false }));
    }, []);

    const toggleHands = () => {
        const next = !twoHands;
        setTwoHands(next);
        regenerate(next);
    };

    return (
        <main className="mx-auto max-w-3xl space-y-5 p-6 font-sans">
            <header className="space-y-1">
                <h1 className="text-2xl font-semibold">{m.sprint_title()}</h1>
                <p className="text-sm text-gray-600 dark:text-gray-400">{m.sprint_intro()}</p>
            </header>

            <div className="flex flex-wrap items-center gap-3">
                <button
                    type="button"
                    onClick={() => regenerate(twoHands)}
                    className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white"
                >
                    {m.sprint_fresh()}
                </button>
                <button
                    type="button"
                    onClick={toggleHands}
                    aria-pressed={twoHands}
                    className={
                        twoHands
                            ? "rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white"
                            : "rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 dark:border-gray-700 dark:text-gray-300"
                    }
                >
                    {m.sprint_two_hands()}
                </button>
            </div>

            {xml && (
                <ScoreViewer
                    key={run}
                    id="sprint"
                    xml={xml}
                    title={m.sprint_title()}
                    beatsPerBar={OPTIONS.beatsPerBar}
                    ephemeral
                />
            )}

            <Link to="/" className="text-sm text-indigo-700 underline dark:text-indigo-300">
                {m.action_back_home()}
            </Link>
        </main>
    );
}
