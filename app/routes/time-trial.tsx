// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { Route } from "./+types/time-trial";
import { TimeTrial } from "../components/timeTrial";
import { resolveExercise } from "../lib/songs";

export function meta(_args: Route.MetaArgs) {
    return [
        { title: "Plinky - Time Trial" },
        { name: "description", content: "Compete against yourself ... on time!" },
    ];
}

export default function TimeTrialRoute({ params }: Route.ComponentProps) {
    const exercise = resolveExercise(params.exerciseId);
    if (!exercise) {
        throw new Response("Exercise not found", { status: 404 });
    }
    return <TimeTrial exercise={exercise} />;
}
