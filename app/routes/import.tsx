// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import abcjs from "abcjs";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { exercises } from "../lib/exercises";
import { decodeSong } from "../lib/share";
import { buildExercise, loadUserSongs, saveUserSong } from "../lib/songs";
import { buildSteps } from "../lib/steps";
import type { Route } from "./+types/import";

export function meta(_args: Route.MetaArgs) {
    return [
        { title: "Plinky - Shared song" },
        { name: "description", content: "Open a shared Plinky song" },
    ];
}

function isPlayable(abc: string): boolean {
    const element = document.createElement("div");
    element.style.position = "absolute";
    element.style.visibility = "hidden";
    document.body.appendChild(element);
    try {
        const tune = abcjs.renderAbc(element, abc, { add_classes: true })[0];
        return !!tune && buildSteps(tune, 100).length > 0;
    } catch {
        return false;
    } finally {
        element.remove();
    }
}

type Outcome = { ok: true; id: string; title: string } | { ok: false; message: string };

export default function ImportRoute() {
    const [outcome, setOutcome] = useState<Outcome | null>(null);

    useEffect(() => {
        const encoded = new URLSearchParams(window.location.hash.replace(/^#/, "")).get("s");
        if (!encoded) {
            setOutcome({ ok: false, message: "This link has no song in it." });
            return;
        }
        const abc = decodeSong(encoded);
        if (!abc || !isPlayable(abc)) {
            setOutcome({ ok: false, message: "This link does not contain a playable song." });
            return;
        }
        const ids = [...exercises.map((e) => e.id), ...loadUserSongs().map((song) => song.id)];
        const exercise = buildExercise(abc, ids);
        saveUserSong(exercise);
        setOutcome({ ok: true, id: exercise.id, title: exercise.title });
    }, []);

    return (
        <main className="mx-auto max-w-3xl space-y-4 p-6 font-sans">
            <h1 className="text-2xl font-semibold">Shared song</h1>

            {outcome === null && <p className="text-sm text-gray-500">Reading the link…</p>}

            {outcome?.ok === false && (
                <div className="space-y-3">
                    <p className="text-sm text-red-600">{outcome.message}</p>
                    <Link to="/" className="text-sm text-indigo-700 underline">
                        Back to exercises
                    </Link>
                </div>
            )}

            {outcome?.ok === true && (
                <div className="space-y-3">
                    <p className="text-sm text-gray-600">
                        Added <span className="font-medium">{outcome.title}</span> to your library
                        on this device.
                    </p>
                    <div className="flex flex-wrap gap-2">
                        <Link
                            to={`/practice/${outcome.id}`}
                            className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white"
                        >
                            Practice it
                        </Link>
                        <Link
                            to="/"
                            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700"
                        >
                            All exercises
                        </Link>
                    </div>
                </div>
            )}
        </main>
    );
}
