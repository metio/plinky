// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { Route } from "./+types/rhythm";
import { RhythmTrainer } from "../components/rhythmTrainer";
import { findExercise } from "../lib/exercises";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Plinky - Rhythm" },
    { name: "description", content: "Play in time with the metronome" },
  ];
}

export default function RhythmRoute({ params }: Route.ComponentProps) {
  const exercise = findExercise(params.exerciseId);
  if (!exercise) {
    throw new Response("Exercise not found", { status: 404 });
  }
  return <RhythmTrainer exercise={exercise} />;
}
