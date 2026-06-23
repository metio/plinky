import { Link } from "react-router";
import type { Route } from "./+types/home";
import { exercises } from "../lib/exercises";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Plinky" },
    { name: "description", content: "Practice piano with your MIDI keyboard." },
  ];
}

const MODES = [
  { slug: "practice", label: "Practice" },
  { slug: "time-trial", label: "Time trial" },
  { slug: "rhythm", label: "Rhythm" },
];

export default function Home() {
  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6 font-sans">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Exercises</h1>
        <p className="text-sm text-gray-500">
          Pick an exercise, then choose a mode. Connect a MIDI piano or play with your computer
          keyboard.
        </p>
      </header>

      <ul className="space-y-3">
        {exercises.map((exercise) => (
          <li key={exercise.id} className="rounded-md border border-gray-200 p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-lg font-medium">{exercise.title}</h2>
              <span className="font-mono text-xs text-gray-400">{exercise.tempo} bpm</span>
            </div>
            <p className="mt-1 text-sm text-gray-500">{exercise.description}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {MODES.map((mode) => (
                <Link
                  key={mode.slug}
                  to={`/${mode.slug}/${exercise.id}`}
                  className="rounded-md bg-indigo-50 px-3 py-1.5 text-sm font-medium text-indigo-700 hover:bg-indigo-100"
                >
                  {mode.label}
                </Link>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
