// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { ReactNode } from "react";
import { useLocation } from "react-router";
import { m } from "../../paraglide/messages.js";
import { localizeHref } from "../../paraglide/runtime.js";
import { BookIcon, GradCapIcon, HomeIcon, NotesIcon, TargetIcon } from "./icons";
import { LocalizedLink as Link } from "./localizedLink";

// The app's primary destinations. Before this, every section was reachable only as a
// home-page tile, so moving between Library/Daily/Compose/You meant a round-trip
// through home — these get a persistent bar (a bottom tab bar on phones, header links
// on wide screens). Settings stays the header gear; the rest reach from here or home.
const DESTINATIONS: {
    to: string;
    label: () => string;
    Icon: (props: { className?: string }) => ReactNode;
}[] = [
    { to: "/", label: m.nav_home, Icon: HomeIcon },
    { to: "/library", label: m.nav_library, Icon: BookIcon },
    { to: "/daily", label: m.nav_daily, Icon: TargetIcon },
    { to: "/compose", label: m.nav_compose, Icon: NotesIcon },
    { to: "/you", label: m.nav_you, Icon: GradCapIcon },
];

// Marks the current section. Home matches only its exact path; the rest also match
// their sub-pages (e.g. /library stays lit while reading a piece under it).
function useIsActive(): (to: string) => boolean {
    const { pathname } = useLocation();
    return (to) => {
        const href = localizeHref(to);
        if (to === "/") {
            return pathname === href || pathname === `${href}/`;
        }
        return pathname === href || pathname.startsWith(`${href}/`);
    };
}

// Mobile: a fixed bottom tab bar (the platform-standard pattern), one tap to any
// primary section. Hidden on wide screens, where the header links take over.
export function BottomNav() {
    const isActive = useIsActive();
    return (
        <nav
            aria-label={m.nav_primary_label()}
            className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden dark:border-gray-800 dark:bg-gray-950/95"
        >
            <ul className="mx-auto flex max-w-3xl">
                {DESTINATIONS.map(({ to, label, Icon }) => {
                    const active = isActive(to);
                    return (
                        <li key={to} className="flex-1">
                            <Link
                                to={to}
                                aria-current={active ? "page" : undefined}
                                className={`flex min-h-14 flex-col items-center justify-center gap-0.5 py-2 text-xs font-medium ${
                                    active
                                        ? "text-indigo-600 dark:text-indigo-400"
                                        : "text-gray-500 dark:text-gray-400"
                                }`}
                            >
                                <Icon className="h-6 w-6" />
                                {label()}
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
                        className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                            active
                                ? "text-indigo-600 dark:text-indigo-400"
                                : "text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
                        }`}
                    >
                        {label()}
                    </Link>
                );
            })}
        </nav>
    );
}
