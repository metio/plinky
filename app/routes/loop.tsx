// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { LoopTrainer } from "../components/loopTrainer";
import { pageTitle } from "../lib/site";
import { resolveExercise } from "../lib/songs";
import type { Route } from "./+types/loop";

export function meta({ params }: Route.MetaArgs) {
    const exercise = resolveExercise(params.exerciseId);
    return [
        { title: exercise ? pageTitle(exercise.title, "Loop") : pageTitle("Loop") },
        { name: "description", content: "Loop a section of a song until you have learned it" },
    ];
}

export default function LoopRoute({ params }: Route.ComponentProps) {
    const exercise = resolveExercise(params.exerciseId);
    if (!exercise) {
        throw new Response("Exercise not found", { status: 404 });
    }
    return <LoopTrainer exercise={exercise} />;
}
