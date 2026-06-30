// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useEffect, useState } from "react";
import { discoveries } from "../lib/onboarding";
import { hasSeenHint, markHintSeen } from "../lib/seenHints";
import { m } from "../paraglide/messages.js";
import { CloseIcon } from "./icons";
import { LocalizedLink as Link } from "./localizedLink";

// The first song a true beginner is handed: a Grade 1 piece in Play mode, where the
// labelled keys (note labels default to the C landmark) let someone who has never
// touched a piano find their way.
const FIRST_SONG = "/play/twinkle-twinkle";
const DISMISSED = "beginner-start";

// A zero-knowledge front door on the home page: for someone who has never played, it
// names the one thing to do first and reassures them that reading music comes later.
// It disappears the moment they've played anything — past that, the Today panel and
// the discovery checklist take over — and the ✕ dismisses it for good for anyone who
// arrives already knowing their way around.
export function BeginnerStart() {
    // Shown by default so it is part of the prerendered shell: a true newcomer — the
    // common first visit, and the state every prerender captures — sees the card in the
    // first paint, so it never shifts the page in (which would cost CLS). The "have they
    // played" and dismissal signals live in localStorage, absent at prerender, so a
    // returning visitor is filtered out on the client after mount instead.
    const [show, setShow] = useState(true);

    useEffect(() => {
        if (hasSeenHint(DISMISSED) || discoveries().played) {
            setShow(false);
        }
    }, []);

    if (!show) {
        return null;
    }

    const dismiss = () => {
        markHintSeen(DISMISSED);
        setShow(false);
    };

    return (
        <section className="space-y-3 rounded-xl border border-violet-200 bg-violet-50/60 p-5 dark:border-violet-900 dark:bg-violet-950/30">
            <div className="flex items-start justify-between gap-2">
                <h2 className="font-semibold text-violet-900 dark:text-violet-100">
                    {m.beginner_heading()}
                </h2>
                <button
                    type="button"
                    onClick={dismiss}
                    aria-label={m.action_dismiss()}
                    className="shrink-0 p-1 leading-none text-violet-700 dark:text-violet-300"
                >
                    <CloseIcon className="h-4 w-4" />
                </button>
            </div>
            <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-300">
                {m.beginner_intro()}
            </p>
            <Link
                to={FIRST_SONG}
                className="inline-flex items-center rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-violet-700"
            >
                {m.beginner_cta()} →
            </Link>
        </section>
    );
}
