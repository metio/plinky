// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { ReactNode } from "react";
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
    onHear,
    onHearPlain,
}: {
    entry: GlossaryEntry;
    example: ReactNode;
    onHear: () => void;
    // Null when the mark changes nothing you could hear — a slur or a clef instructs
    // the hands, and offering to play it "without" would promise a difference that
    // isn't there.
    onHearPlain: (() => void) | null;
}) {
    return (
        <article className="space-y-4">
            <header className="space-y-1">
                <p className="text-xs font-medium uppercase tracking-wide text-indigo-600 dark:text-indigo-400">
                    {CATEGORY_NAMES[entry.category]()}
                </p>
                <h2 className="text-xl font-semibold">{symbolName(entry.id)}</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">{symbolGloss(entry.id)}</p>
            </header>

            {example}

            <div className="flex flex-wrap gap-2">
                <Button variant="primary" onClick={onHear}>
                    {m.glossary_hear()}
                </Button>
                {onHearPlain && (
                    <Button variant="secondary" onClick={onHearPlain}>
                        {m.glossary_hear_plain()}
                    </Button>
                )}
            </div>
        </article>
    );
}
