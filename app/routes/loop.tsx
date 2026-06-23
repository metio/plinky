// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { LoopTrainer } from "../components/loopTrainer";
import { routeMeta } from "../lib/site";
import { resolveExercise } from "../lib/songs";
import type { Route } from "./+types/loop";

export function meta({ params }: Route.MetaArgs) {
    const exercise = resolveExercise(params.exerciseId);
    const headline = exercise ? `${exercise.title} · Loop` : "Loop";
    return routeMeta(headline, "Loop a section of a song until you have learned it");
}

export default function LoopRoute({ params }: Route.ComponentProps) {
    const exercise = resolveExercise(params.exerciseId);
    if (!exercise) {
        throw new Response("Exercise not found", { status: 404 });
    }
    return <LoopTrainer exercise={exercise} />;
}
