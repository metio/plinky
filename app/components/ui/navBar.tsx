// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { ReactNode } from "react";
import { useLocation } from "react-router";
import { withTrailingSlash } from "../../../core/site";
import { m } from "../../paraglide/messages.js";
import { BookIcon, GradCapIcon, MicIcon, NotesIcon } from "./icons";
import { LocalizedLink as Link } from "./localizedLink";
import { localizedHref } from "./href";

// The app's four permanent places, each answering a different question: what shall I
// play now, what is there to play, what does this mean, how am I getting on. Naming
// them as one kind of thing is the point — a bar that mixes a page, a place, a piece
// and a verb teaches no model, so nothing can be predicted from it.
//
// The daily challenge is a *today* thing and leads the warm-up on Today; Compose is
// music you make and sits on Music beside the music you import. Both keep their URLs.
// Settings and Help stay the header icons.
const DESTINATIONS: {
    to: string;
    label: () => string;
    Icon: (props: { className?: string }) => ReactNode;
}[] = [
    { to: "/music", label: m.music_title, Icon: NotesIcon },
    { to: "/learn", label: m.nav_learn, Icon: BookIcon },
    { to: "/compose", label: m.nav_compose, Icon: MicIcon },
    { to: "/teach", label: m.nav_teach, Icon: GradCapIcon },
];

// Marks the current section. Home matches only its exact path; the rest also match
// their sub-pages (e.g. /music stays lit while reading a piece under it). Both sides
// are normalized to the trailing-slash form the links carry, so a visitor who arrives
// on the bare path before the host redirects still sees their section lit.
function useIsActive(): (to: string) => boolean {
    const { pathname } = useLocation();
    return (to) => {
        const href = localizedHref(to);
        const here = withTrailingSlash(pathname);
        // Every href ends in "/", so the prefix test covers the exact match too and
        // cannot mistake a sibling section (/music/ never matches /musicology/).
        return to === "/" ? here === href : here.startsWith(href);
    };
}

// Mobile: a fixed bottom tab bar (the platform-standard pattern), one tap to any
// primary section. Hidden on wide screens, where the header links take over.
export function BottomNav() {
    const isActive = useIsActive();
    return (
        <nav
            aria-label={m.nav_primary_label()}
            className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden print:hidden"
        >
            <ul className="mx-auto flex max-w-3xl">
                {DESTINATIONS.map(({ to, label, Icon }) => {
                    const active = isActive(to);
                    return (
                        <li key={to} className="min-w-0 flex-1">
                            <Link
                                to={to}
                                aria-current={active ? "page" : undefined}
                                className={`flex min-h-14 flex-col items-center justify-center gap-0.5 border-t-2 py-2 text-xs font-medium ${
                                    active
                                        ? "border-spark text-ink"
                                        : "border-transparent text-muted"
                                }`}
                            >
                                <Icon className="h-6 w-6" />
                                <span className="max-w-full truncate">{label()}</span>
                            </Link>
                        </li>
                    );
                })}
            </ul>
        </nav>
    );
}

// Wide screens: the same destinations as inline header links.
export function HeaderNav({ className = "" }: { className?: string }) {
    const isActive = useIsActive();
    return (
        <nav aria-label={m.nav_primary_label()} className={className}>
            {DESTINATIONS.map(({ to, label }) => {
                const active = isActive(to);
                return (
                    <Link
                        key={to}
                        to={to}
                        aria-current={active ? "page" : undefined}
                        className={`border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                            active
                                ? "border-spark text-ink"
                                : "border-transparent text-muted hover:text-ink"
                        }`}
                    >
                        {label()}
                    </Link>
                );
            })}
        </nav>
    );
}
