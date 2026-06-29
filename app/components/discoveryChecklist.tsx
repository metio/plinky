// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useEffect, useState } from "react";
import {
    type DiscoveryId,
    type DiscoveryProgress,
    discoveries,
    discoveryProgress,
} from "../lib/onboarding";
import { hasSeenHint, markHintSeen } from "../lib/seenHints";
import { m } from "../paraglide/messages.js";
import { CheckIcon, CloseIcon } from "./icons";
import { LocalizedLink as Link } from "./localizedLink";

// The feature-discovery checklist: an opt-in tour of the app's corners, each step
// completed by doing it and deep-linking to where you do it. Order runs from the
// first thing a new player does to the more advanced surfaces. It lives on the home
// page — where a first-time player actually lands — so the tour is discoverable
// rather than buried; the ✕ dismisses it for good (for fast starters), and it hides
// itself once every step is done.
const DISCOVERY: { key: DiscoveryId; icon: string; label: () => string; to: string }[] = [
    { key: "played", icon: "🎹", label: m.grades_start_play, to: "/library" },
    { key: "handSet", icon: "✋", label: m.grades_start_hand, to: "/settings" },
    { key: "dailyDone", icon: "📅", label: m.grades_start_daily, to: "/daily" },
    { key: "earTried", icon: "👂", label: m.discover_ear, to: "/play/twinkle-twinkle?mode=ear" },
    {
        key: "fingeringTried",
        icon: "🎯",
        label: m.discover_fingering,
        to: "/play/twinkle-twinkle?mode=fingering",
    },
    { key: "composed", icon: "🎼", label: m.discover_compose, to: "/compose" },
    { key: "imported", icon: "📥", label: m.discover_import, to: "/library/import" },
    { key: "keysCustomized", icon: "⌨️", label: m.discover_keys, to: "/settings" },
];

const DISCOVERY_DISMISSED = "discovery-panel";
const LINK = "text-indigo-700 underline dark:text-indigo-300";

export function DiscoveryChecklist() {
    // Resolves on the client only: the completion state and the dismissal both live in
    // localStorage, absent at prerender. Null until then keeps the static shell — and
    // CLS — stable, then the panel appears for a player who still has corners to find.
    const [state, setState] = useState<{
        done: Record<DiscoveryId, boolean>;
        progress: DiscoveryProgress;
        dismissed: boolean;
    } | null>(null);

    useEffect(() => {
        const done = discoveries();
        setState({
            done,
            progress: discoveryProgress(done),
            dismissed: hasSeenHint(DISCOVERY_DISMISSED),
        });
    }, []);

    if (!state || state.dismissed || state.progress.allDone) {
        return null;
    }

    const dismiss = () => {
        markHintSeen(DISCOVERY_DISMISSED);
        setState((prev) => (prev ? { ...prev, dismissed: true } : prev));
    };

    return (
        <section className="space-y-3 rounded-md border border-indigo-200 bg-indigo-50/50 p-4 dark:border-indigo-900 dark:bg-indigo-950/30">
            <div className="flex items-start justify-between gap-2">
                <h2 className="font-semibold text-indigo-800 dark:text-indigo-200">
                    {m.discover_heading()}
                </h2>
                <button
                    type="button"
                    onClick={dismiss}
                    aria-label={m.action_dismiss()}
                    className="shrink-0 p-1 leading-none text-indigo-700 dark:text-indigo-300"
                >
                    <CloseIcon className="h-4 w-4" />
                </button>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
                {m.discover_intro()}{" "}
                <span className="font-medium tabular-nums">
                    {m.discover_progress({
                        done: state.progress.done,
                        total: state.progress.total,
                    })}
                </span>
            </p>
            <ul className="space-y-1.5 text-sm">
                {DISCOVERY.map((step) => {
                    const stepDone = state.done[step.key];
                    return (
                        <li key={step.key} className="flex items-center gap-2">
                            <span
                                aria-hidden="true"
                                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                                    stepDone
                                        ? "bg-green-600 text-white"
                                        : "border border-gray-300 dark:border-gray-600"
                                }`}
                            >
                                {stepDone && <CheckIcon className="h-3.5 w-3.5" />}
                            </span>
                            <span aria-hidden="true">{step.icon}</span>
                            <Link
                                to={step.to}
                                className={
                                    stepDone
                                        ? "text-gray-500 line-through dark:text-gray-400"
                                        : LINK
                                }
                            >
                                {step.label()}
                            </Link>
                        </li>
                    );
                })}
            </ul>
        </section>
    );
}
