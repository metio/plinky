// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { TempoTrainer } from "../components/tempoTrainer";
import { resolveExercise } from "../lib/songs";
import type { Route } from "./+types/tempo";

export function meta(_args: Route.MetaArgs) {
    return [
        { title: "Plinky - Tempo" },
        { name: "description", content: "Play at your own pace and chart your tempo" },
    ];
}

export default function TempoRoute({ params }: Route.ComponentProps) {
    const exercise = resolveExercise(params.exerciseId);
    if (!exercise) {
        throw new Response("Exercise not found", { status: 404 });
    }
    return <TempoTrainer exercise={exercise} />;
}
