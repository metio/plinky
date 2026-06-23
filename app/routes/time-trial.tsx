// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { TimeTrial } from "../components/timeTrial";
import { pageTitle } from "../lib/site";
import { resolveExercise } from "../lib/songs";
import type { Route } from "./+types/time-trial";

export function meta({ params }: Route.MetaArgs) {
    const exercise = resolveExercise(params.exerciseId);
    return [
        { title: exercise ? pageTitle(exercise.title, "Time trial") : pageTitle("Time trial") },
        { name: "description", content: "Race through a phrase as fast and cleanly as you can" },
    ];
}

export default function TimeTrialRoute({ params }: Route.ComponentProps) {
    const exercise = resolveExercise(params.exerciseId);
    if (!exercise) {
        throw new Response("Exercise not found", { status: 404 });
    }
    return <TimeTrial exercise={exercise} />;
}
