// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { type ReactNode, useEffect, useRef } from "react";
import type { GlossaryEntry } from "../../../core/glossary";
import { CATEGORY_NAMES, symbolGloss, symbolName } from "../../lib/glossaryLabels";
import { m } from "../../paraglide/messages.js";
import { Button } from "../ui/button";

// One symbol: what it is called, what it asks of you, a bar of music using it, and the
// chance to hear what it does.
//
// The notation arrives as a slot rather than being drawn here, so this stays a plain
// piece of layout with nothing async in it — the drawing engine loads on its own
// schedule, and a story or a test can hand in a still picture instead.
export function GlossaryDetail({
    entry,
    example,
    sounding = false,
    onHear,
    onHearPlain,
}: {
    entry: GlossaryEntry;
    example: ReactNode;
    // Whether the phrase is still on the speakers. Both buttons rest until it ends, so
    // two readings can't overlap into something neither of them sounds like.
    sounding?: boolean;
    onHear: () => void;
    // Null when the mark changes nothing you could hear — a slur or a clef instructs
    // the hands, and offering to play it "without" would promise a difference that
    // isn't there.
    onHearPlain: (() => void) | null;
}) {
    const heading = useRef<HTMLHeadingElement>(null);
    // Skip the first render: arriving on the page should not yank focus out of the
    // document flow, only choosing a symbol should.
    const opening = useRef(true);

    // Choosing a symbol replaces everything below the index, and on a phone the index
    // is tall enough that this pane sits under the fold — so a tap would change a
    // screenful the reader cannot see. Moving focus to the new heading both scrolls it
    // into view and tells a screen reader what it landed on. It runs after the render
    // rather than from the index's click handler on purpose: at click time the heading
    // still holds the previous symbol's name, and focusing it there would announce the
    // one being left instead of the one being opened.
    // biome-ignore lint/correctness/useExhaustiveDependencies: entry.id is the trigger, not a read — the body only touches refs
    useEffect(() => {
        if (opening.current) {
            opening.current = false;
            return;
        }
        heading.current?.focus();
    }, [entry.id]);

    return (
        <article className="space-y-4">
            <header className="space-y-1">
                <p className="text-xs font-medium uppercase tracking-wide text-accent">
                    {CATEGORY_NAMES[entry.category]()}
                </p>
                <h2
                    ref={heading}
                    // Focusable only programmatically: it is a scroll-and-announce target
                    // for the index, never a stop on the tab route.
                    tabIndex={-1}
                    className="text-xl font-semibold"
                >
                    {symbolName(entry.id)}
                </h2>
                <p className="text-sm text-muted">{symbolGloss(entry.id)}</p>
            </header>

            {example}

            <div className="flex flex-wrap gap-2">
                <Button variant="primary" onClick={onHear} disabled={sounding}>
                    {m.glossary_hear()}
                </Button>
                {onHearPlain && (
                    <Button variant="secondary" onClick={onHearPlain} disabled={sounding}>
                        {m.glossary_hear_plain()}
                    </Button>
                )}
            </div>
        </article>
    );
}
