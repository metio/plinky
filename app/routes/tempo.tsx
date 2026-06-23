// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { TempoTrainer } from "../components/tempoTrainer";
import { routeMeta } from "../lib/site";
import { resolveExercise } from "../lib/songs";
import type { Route } from "./+types/tempo";

export function meta({ params }: Route.MetaArgs) {
    const exercise = resolveExercise(params.exerciseId);
    const headline = exercise ? `${exercise.title} · Tempo` : "Tempo";
    return routeMeta(headline, "Play at your own pace and chart your tempo");
}

export default function TempoRoute({ params }: Route.ComponentProps) {
    const exercise = resolveExercise(params.exerciseId);
    if (!exercise) {
        throw new Response("Exercise not found", { status: 404 });
    }
    return <TempoTrainer exercise={exercise} />;
}
