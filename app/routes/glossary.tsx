// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { demoOf } from "../../core/theoryDemo";
import { SoundingKeyboard } from "../components/features/soundingKeyboard";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router";
import {
    entryById,
    GLOSSARY,
    type GlossaryEntry,
    performSnippet,
    snippetSeconds,
} from "../../core/glossary";
import { outOfView } from "../../core/followScroll";
import { buildSnippet, type Snippet } from "../../core/glossaryScore";
import { breadcrumbData, definedTermData, routeMeta, webPageData } from "../../core/site";
import { GlossaryDetail } from "../components/features/glossaryDetail";
import { GlossaryIndex } from "../components/features/glossaryIndex";
import { NotationExample } from "../components/features/notationExample";
import { FeatureBoundary } from "../components/features/featureBoundary";
import { useScheduler } from "../contexts/services";
import { useSynth } from "../hooks/useSynth";
import type { SchedulerHandle } from "../ports/scheduler";
import { symbolGloss, symbolName } from "../lib/glossaryLabels";
import { m } from "../paraglide/messages.js";
import { getLocale } from "../paraglide/runtime.js";
import type { Route } from "./+types/glossary";
import { PageHeader } from "../components/ui/pageHeader";

export function meta({ params }: Route.MetaArgs) {
    const locale = getLocale();
    // A mark's own page. Every one of them is prerendered, so this is what a reader and a
    // crawler are handed before any script runs — and it is also what the app renders
    // over on hydration, so the two say the same thing by construction.
    const mark = entryById(params.term ?? "");
    if (mark) {
        return [
            ...routeMeta(symbolName(mark.id), symbolGloss(mark.id)),
            {
                "script:ld+json": definedTermData(
                    locale,
                    `/glossary/${mark.id}/`,
                    symbolName(mark.id),
                    symbolGloss(mark.id),
                    m.glossary_title(),
                ),
            },
            {
                "script:ld+json": breadcrumbData(locale, [
                    { name: m.nav_today(), path: "/" },
                    { name: m.glossary_title(), path: "/glossary/" },
                    { name: symbolName(mark.id), path: `/glossary/${mark.id}/` },
                ]),
            },
        ];
    }
    return [
        ...routeMeta(m.glossary_title(), m.meta_glossary_description()),
        {
            "script:ld+json": webPageData(
                m.glossary_title(),
                m.meta_glossary_description(),
                locale,
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
    // A piece links here naming the mark the reader just met (?symbol=slur), so the
    // answer is the first thing on screen rather than something to hunt for. An unknown
    // or absent name simply opens the first entry.
    const [params] = useSearchParams();
    // The mark's own address (/glossary/fermata) if that is how the page was reached,
    // and the older query link otherwise. Both name the same page; the address is the one
    // a search engine can hold, and the one the index links to.
    //
    // The address IS the state. Choosing a mark used to set a value here and write the URL
    // afterwards, which meant the page could show one mark while the address named another
    // if either half failed. Reading straight from the route removes the second copy, and
    // the back button works because it is the only copy.
    const route = useParams();
    const named = route.term ?? params.get("symbol");
    const entry = entryById(named ?? "") ?? FIRST;
    // Whether the address names one mark. The head for it is written by meta() above,
    // which both the prerendered document and the running app go through — so a mark's
    // page says the same thing before and after its script loads.
    const onTerm = route.term !== undefined && entryById(route.term) !== null;
    const synth = useSynth();
    const scheduler = useScheduler();

    // Strikes are scheduled ahead on the audio clock, so a second press before the
    // first phrase has finished lays one reading over the other and the comparison —
    // the whole point of the pair — turns to mush. The buttons rest until it ends.
    const [sounding, setSounding] = useState(false);
    const until = useRef<SchedulerHandle | null>(null);

    // A phrase left sounding when the page goes away must not come back to set state on
    // a gone component, and picking another symbol frees its buttons straight away.
    useEffect(() => {
        return () => {
            if (until.current) {
                scheduler.cancel(until.current);
            }
        };
    }, [scheduler]);

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
        if (until.current) {
            scheduler.cancel(until.current);
        }
        setSounding(true);
        // The written length of the phrase is exactly how long it occupies the speakers.
        until.current = scheduler.after(snippetSeconds(snippet) * 1000, () => {
            until.current = null;
            setSounding(false);
        });
    };

    const detailRef = useRef<HTMLDivElement>(null);

    // Choosing a mark is a navigation, so what a click handler used to do on the way out
    // now happens when the mark being read changes. The previous phrase may still be
    // ringing and it belongs to a symbol no longer on screen, so the new one's buttons
    // should be ready immediately. The timer is JS and the strikes are on the audio clock:
    // cancelling the one and leaving the other sounding under the new symbol's reading is
    // exactly the mush this prevents. Harmless on the first render, where nothing sounds.
    // biome-ignore lint/correctness/useExhaustiveDependencies: entry.id is the trigger, not a read — the body only touches refs
    useEffect(() => {
        if (until.current) {
            scheduler.cancel(until.current);
            until.current = null;
        }
        synth.silenceAll();
        setSounding(false);
    }, [entry.id, scheduler, synth]);

    // Stacked on a phone, the list runs the height of the screen and the mark's
    // explanation sits under all of it, so a tap looks like it did nothing. Bring the
    // detail up — only when it is ENTIRELY off screen. On the two-column layout the detail
    // is beside the list and always partly visible, so nothing moves there.
    //
    // Never on arrival, only on a change: somebody opening /glossary/fermata directly has
    // not tapped anything, and a page that scrolls itself the moment it loads has taken the
    // top of itself away from a reader who never asked.
    const arrived = useRef(false);
    // biome-ignore lint/correctness/useExhaustiveDependencies: entry.id is the trigger, not a read — the body only touches refs
    useEffect(() => {
        if (!arrived.current) {
            arrived.current = true;
            return;
        }
        const frame = scheduler.frame(() => {
            const box = detailRef.current?.getBoundingClientRect();
            if (box && outOfView(box.top, box.bottom, window.innerHeight)) {
                detailRef.current?.scrollIntoView({
                    behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
                        ? "auto"
                        : "smooth",
                    block: "start",
                });
            }
            scheduler.cancelFrame(frame);
        });
    }, [entry.id, scheduler]);

    // Leaving the page mid-phrase must not let the rest of it play over the next one.
    useEffect(() => () => synth.silenceAll(), [synth]);

    return (
        // Wider than the rest of the app on purpose: this is the one page laid out as
        // two columns, and the list of marks beside its detail needs the room. Everything
        // else is a single column and shares one frame.
        <main className="mx-auto max-w-4xl space-y-6 p-6 font-sans">
            <PageHeader
                title={onTerm ? symbolName(entry.id) : m.glossary_title()}
                // No hint on a mark's own page: the entry beside it opens with the very
                // same sentence, and the address naming one mark is exactly when the two
                // would sit a few pixels apart saying the same thing.
                hint={onTerm ? undefined : m.glossary_intro()}
            />

            <div className="grid gap-6 md:grid-cols-[14rem_1fr]">
                <GlossaryIndex selected={entry.id} />
                <div ref={detailRef}>
                    <GlossaryDetail
                        entry={entry}
                        example={
                            // A drawing engine given a file it dislikes can throw rather than
                            // reject, which the load path's catch never sees — and the reader
                            // would lose the words explaining the symbol along with the picture.
                            <FeatureBoundary feature="NotationExample">
                                <NotationExample
                                    // A fresh element per symbol, so the engine tears down and
                                    // redraws rather than trying to swap a score under itself.
                                    key={entry.id}
                                    xml={xml}
                                    // The gloss is already read out as text right above the
                                    // drawing, so labelling the picture with it again would say
                                    // the same sentence twice. The name identifies it instead.
                                    label={symbolName(entry.id)}
                                />
                            </FeatureBoundary>
                        }
                        keys={
                            // The mark under a pair of hands, beside the engraving of it.
                            // The keyboard is the theory course's own — one component, so a
                            // symbol looks the same wherever the app explains it — reading
                            // the entry through core/theoryDemo, which is what turns a bar
                            // written for an engraver into positions written for keys.
                            <SoundingKeyboard
                                key={entry.id}
                                score={demoOf(entry.shown)}
                                label={m.glossary_hear_keys()}
                                onPlay={() => play(entry.shown)}
                            />
                        }
                        sounding={sounding}
                        onHear={() => play(entry.shown)}
                        onHearPlain={entry.plain ? () => play(entry.plain as Snippet) : null}
                    />
                </div>
            </div>
        </main>
    );
}
