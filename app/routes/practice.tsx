// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { SightReadingTrainer } from "../components/sightReadingTrainer";
import { pageTitle } from "../lib/site";
import { resolveExercise } from "../lib/songs";
import type { Route } from "./+types/practice";

export function meta({ params }: Route.MetaArgs) {
    const exercise = resolveExercise(params.exerciseId);
    return [
        { title: exercise ? pageTitle(exercise.title, "Practice") : pageTitle("Practice") },
        { name: "description", content: "Sight-reading practice with your MIDI piano" },
    ];
}

export default function PracticeRoute({ params }: Route.ComponentProps) {
    const exercise = resolveExercise(params.exerciseId);
    if (!exercise) {
        throw new Response("Exercise not found", { status: 404 });
    }
    return <SightReadingTrainer exercise={exercise} />;
}
