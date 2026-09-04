// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useCallback, useState } from "react";
import { Link } from "react-router";
import { useMidiInput } from "../contexts/midi";
import { PianoKeyboard } from "../components/features/pianoKeyboard";
import { PageHeader } from "../components/ui/pageHeader";
import { followKeyboardWindow, type Span } from "../../core/keyboardWindow";
import { routeMeta, webPageData } from "../../core/site";
import { m } from "../paraglide/messages.js";
import { getLocale } from "../paraglide/runtime.js";
import type { Route } from "./+types/piano";

export function meta(_args: Route.MetaArgs) {
    return [
        ...routeMeta(m.meta_piano_title(), m.meta_piano_description()),
        {
            "script:ld+json": webPageData(
                m.meta_piano_title(),
                m.meta_piano_description(),
                getLocale(),
                "/piano/",
            ),
        },
    ];
}

// Somewhere to just play.
//
// Every other surface here has a purpose it is asking of you — a piece to practise, a
// take to record, an interval to name. That is the whole app, and it is the right shape
// for it, but it means somebody who wants to press a few keys has to enter a lesson to do
// it. This page asks nothing: the instrument, and no more.
//
// It is the same instrument, not a lesser one. The keys are the app's own PianoKeyboard on
// the app's own input funnel, so a MIDI piano, the computer keyboard, a touch and a mouse
// all reach it, the recorded samples sound it, the pedals work, and what is learnt here
// about where the keys are is true everywhere else in the app.

// The full 88-key piano, the range the window can slide across — as free play in compose
// uses, and for the same reason: with no piece to frame, the reach has to be the whole
// instrument or the player runs out of keys wherever they wander.
const REACH: Span = { from: 21, to: 108 };
// Two octaves at a time. Wider is thinner, and a key too narrow to hit is worse than a key
// out of view — the window comes to you when you reach its edge.
const SPAN = 24;

export default function Piano() {
    const [keyWindow, setKeyWindow] = useState<Span>(() =>
        followKeyboardWindow(null, 60, SPAN, REACH),
    );

    // The computer keyboard is an instrument here, which every surface has to say for
    // itself: elsewhere the letter keys belong to the page, and taking them from a page
    // nobody is playing on breaks typing and scrolling for nothing.
    useMidiInput({
        keys: true,
        onNoteOn: useCallback((event: { note: number }) => {
            // Slide the keybed toward what is being played, so climbing off the end of the
            // window carries you into the next octave instead of stopping you at its edge.
            setKeyWindow((prev) => followKeyboardWindow(prev, event.note, SPAN, REACH));
        }, []),
    });

    return (
        <main className="mx-auto max-w-5xl space-y-8 p-6 font-sans">
            <PageHeader title={m.piano_title()} hint={m.piano_intro()} />

            <PianoKeyboard from={keyWindow.from} to={keyWindow.to} />

            <p className="text-sm text-muted">{m.piano_keys_hint()}</p>

            {/* The door onward, and the only thing on the page that asks anything. Quiet,
                and after the instrument rather than before it: somebody who came to press
                keys should get to press keys, and the offer to learn a piece reads as an
                offer only once they have. */}
            <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1 border-t border-line pt-4 text-sm text-muted">
                <span>{m.piano_next()}</span>
                <Link to="/music" className="underline underline-offset-2 hover:text-ink">
                    {m.today_browse()}
                </Link>
                <span aria-hidden="true">·</span>
                <Link to="/compose" className="underline underline-offset-2 hover:text-ink">
                    {m.play_compose()}
                </Link>
            </p>
        </main>
    );
}
