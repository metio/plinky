// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { Route } from "./+types/practice";
import { SightReadingTrainer } from "../components/sightReadingTrainer";
import { resolveExercise } from "../lib/songs";

export function meta(_args: Route.MetaArgs) {
    return [
        { title: "Plinky - Practice" },
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
