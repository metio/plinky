// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { RhythmTrainer } from "../components/rhythmTrainer";
import { pageTitle } from "../lib/site";
import { resolveExercise } from "../lib/songs";
import type { Route } from "./+types/rhythm";

export function meta({ params }: Route.MetaArgs) {
    const exercise = resolveExercise(params.exerciseId);
    return [
        { title: exercise ? pageTitle(exercise.title, "Rhythm") : pageTitle("Rhythm") },
        { name: "description", content: "Play in time with the metronome" },
    ];
}

export default function RhythmRoute({ params }: Route.ComponentProps) {
    const exercise = resolveExercise(params.exerciseId);
    if (!exercise) {
        throw new Response("Exercise not found", { status: 404 });
    }
    return <RhythmTrainer exercise={exercise} />;
}
