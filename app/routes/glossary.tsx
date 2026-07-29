// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useMemo, useState } from "react";
import { entryById, GLOSSARY, performSnippet, type GlossaryEntry } from "../../core/glossary";
import { buildSnippet, type Snippet } from "../../core/glossaryScore";
import { routeMeta, webPageData } from "../../core/site";
import { GlossaryDetail } from "../components/features/glossaryDetail";
import { GlossaryIndex } from "../components/features/glossaryIndex";
import { NotationExample } from "../components/features/notationExample";
import { useSynth } from "../hooks/useSynth";
import { symbolGloss } from "../lib/glossaryLabels";
import { m } from "../paraglide/messages.js";
import { getLocale } from "../paraglide/runtime.js";
import type { Route } from "./+types/glossary";

export function meta(_args: Route.MetaArgs) {
    return [
        ...routeMeta(m.glossary_title(), m.meta_glossary_description()),
        {
            "script:ld+json": webPageData(
                m.glossary_title(),
                m.meta_glossary_description(),
                getLocale(),
                "/glossary/",
                "CollectionPage",
            ),
        },
    ];
}

// What the marks in a score mean, and what each one does to the sound.
//
// A symbol is an instruction for the ear, so every entry can be heard — and where the
// mark changes the sound, heard twice, with and without. That pairing is the thing a
// printed glossary cannot do, and it is why this page exists rather than a table of
// pictures.
const FIRST = GLOSSARY[0] as GlossaryEntry;

export default function Glossary() {
    const [selected, setSelected] = useState(FIRST.id);
    const entry = entryById(selected) ?? FIRST;
    const synth = useSynth();

    // Rebuilt only when the symbol changes: the drawing engine reloads on a new score,
    // and handing it an equal-but-new string every render would redraw for nothing.
    const xml = useMemo(() => buildSnippet(entry.shown), [entry.shown]);

    const play = (snippet: Snippet) => {
        for (const strike of performSnippet(snippet)) {
            synth.playNote(strike.note, {
                velocity: strike.velocity,
                duration: strike.duration,
                delay: strike.delay,
            });
        }
    };

    return (
        <main className="mx-auto max-w-4xl space-y-6 p-6 font-sans">
            <header className="space-y-1">
                <h1 className="text-2xl font-semibold">{m.glossary_title()}</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">{m.glossary_intro()}</p>
            </header>

            <div className="grid gap-6 md:grid-cols-[14rem_1fr]">
                <GlossaryIndex selected={entry.id} onSelect={setSelected} />
                <GlossaryDetail
                    entry={entry}
                    example={
                        <NotationExample
                            // A fresh element per symbol, so the engine tears down and
                            // redraws rather than trying to swap a score under itself.
                            key={entry.id}
                            xml={xml}
                            label={symbolGloss(entry.id)}
                        />
                    }
                    onHear={() => play(entry.shown)}
                    onHearPlain={entry.plain ? () => play(entry.plain as Snippet) : null}
                />
            </div>
        </main>
    );
}
