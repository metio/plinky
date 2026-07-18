// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { routeMeta } from "../../core/site";
import { m } from "../paraglide/messages.js";
import type { Route } from "./+types/about";

export function meta(_args: Route.MetaArgs) {
    return routeMeta(m.about_title(), m.meta_about_description());
}

// The two founders, in the order the operation runs: Marisol leads and gives
// Plinky its warmth; Sebastian builds it. "La Jefa" is her own title, kept as-is
// in every language. Names are literals — they don't translate — so only each
// role and bio flow through paraglide.
const FOUNDERS = [
    {
        name: "Marisol Herrera Rivero",
        role: "La Jefa",
        image: "/founder-marisol.webp",
        bio: m.about_marisol_bio,
    },
    {
        name: "Sebastian Hoß",
        role: m.about_sebastian_role(),
        image: "/founder-sebastian.webp",
        bio: m.about_sebastian_bio,
    },
] as const;

// A two-note "plink" — Plinky's own motif, and here a small duet standing in for
// the two people. Decorative, so it's hidden from assistive tech.
function DuetMark() {
    return (
        <span aria-hidden="true" className="inline-flex items-center gap-1 align-middle">
            <span className="h-1.5 w-6 rounded-full bg-indigo-400" />
            <span className="h-1.5 w-3 rounded-full bg-gray-300 dark:bg-gray-600" />
        </span>
    );
}

export default function About() {
    return (
        <main className="mx-auto max-w-3xl space-y-10 p-6 font-sans">
            <header className="space-y-2">
                <h1 className="flex items-center gap-3 text-2xl font-semibold">
                    {m.about_title()}
                    <DuetMark />
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">{m.about_intro()}</p>
            </header>

            <section className="grid gap-4 sm:grid-cols-2">
                {FOUNDERS.map((founder) => (
                    <article
                        key={founder.name}
                        className="flex flex-col items-center gap-3 rounded-xl border border-gray-200 bg-white p-6 text-center dark:border-gray-800 dark:bg-gray-900"
                    >
                        <img
                            src={founder.image}
                            alt={founder.name}
                            width={112}
                            height={112}
                            loading="lazy"
                            className="h-28 w-28 rounded-full bg-gray-100 object-cover ring-2 ring-indigo-100 dark:bg-gray-800 dark:ring-indigo-900/50"
                        />
                        <div className="space-y-1">
                            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                                {founder.name}
                            </h2>
                            <span className="inline-block rounded-full bg-indigo-50 px-3 py-0.5 text-xs font-medium text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                                {founder.role}
                            </span>
                        </div>
                        <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-300">
                            {founder.bio()}
                        </p>
                    </article>
                ))}
            </section>

            <section className="space-y-3 border-t border-gray-200 pt-8 dark:border-gray-800">
                <h2 className="text-lg font-semibold">{m.about_why_title()}</h2>
                <p className="max-w-prose text-sm leading-relaxed text-gray-600 dark:text-gray-300">
                    {m.about_why_body()}
                </p>
            </section>
        </main>
    );
}
