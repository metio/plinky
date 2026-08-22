// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState } from "react";
import { routeMeta, webPageData } from "../../core/site";
import { RHYTHM_LEVELS } from "../../core/rhythmPattern";
import { FeatureBoundary } from "../components/features/featureBoundary";
import { DEFAULT_RHYTHM_BPM, RhythmTrainer } from "../components/features/rhythmTrainer";
import { ChoiceField } from "../components/ui/fields";
import { PageHeader } from "../components/ui/pageHeader";
import { m } from "../paraglide/messages.js";
import { getLocale } from "../paraglide/runtime.js";
import type { Route } from "./+types/rhythm";

export function meta(_args: Route.MetaArgs) {
    return [
        ...routeMeta(m.meta_rhythm_title(), m.meta_rhythm_description()),
        {
            "script:ld+json": webPageData(
                m.meta_rhythm_title(),
                m.meta_rhythm_description(),
                getLocale(),
                "/rhythm/",
            ),
        },
    ];
}

// The tempos worth reading a rhythm at: slow enough to count sixteenths, fast enough
// that a whole note is not a wait.
const MIN_BPM = 50;
const MAX_BPM = 140;

export default function Rhythm() {
    const [level, setLevel] = useState("0");
    const [bpm, setBpm] = useState(DEFAULT_RHYTHM_BPM);

    return (
        <main className="mx-auto max-w-3xl space-y-8 p-6 font-sans">
            <PageHeader title={m.rhythm_title()} hint={m.rhythm_intro()} />

            {/* The ladder is numbered rather than named. What a level contains is the
                notation on the page, and a name for it would be a word to learn before
                the thing it names. */}
            <ChoiceField
                label={m.rhythm_level_label()}
                value={level}
                onChange={setLevel}
                options={RHYTHM_LEVELS.map((_, index) => ({
                    id: String(index),
                    label: String(index + 1),
                }))}
                help={m.rhythm_level_help()}
            />

            <label className="flex items-center gap-3 text-sm">
                <span className="text-muted">{m.rhythm_tempo()}</span>
                <input
                    type="range"
                    min={MIN_BPM}
                    max={MAX_BPM}
                    step={5}
                    value={bpm}
                    onChange={(event) => setBpm(Number(event.target.value))}
                    className="h-11 min-w-48 flex-1 accent-accent-solid"
                />
                <span className="font-mono tabular-nums text-body">{bpm}</span>
            </label>

            <FeatureBoundary feature="RhythmTrainer">
                {/* Keyed on the pair so a change of level or tempo starts a fresh rhythm —
                    the reset falls out of the remount rather than a handler. */}
                <RhythmTrainer key={`${level}-${bpm}`} level={Number(level)} bpm={bpm} />
            </FeatureBoundary>
        </main>
    );
}
