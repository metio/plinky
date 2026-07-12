// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useEffect, useState } from "react";
import {
    useAssignmentsStore,
    useDailyStore,
    useHintsStore,
    useHistoryStore,
    useMasteryStore,
    useOnboardingStore,
    usePrefsStore,
} from "../../contexts/services";
import {
    type DiscoveryId,
    type DiscoveryProgress,
    discoveries,
    discoveryProgress,
} from "../../../core/onboarding";
import { FIRST_SONG_ID } from "../../lib/catalog";
import { m } from "../../paraglide/messages.js";
import { CheckIcon, CloseIcon } from "../ui/icons";
import { linkClasses } from "../ui/classes";
import { useMidiConnected } from "./conditional";
import { LocalizedLink as Link } from "../ui/localizedLink";
import { Show } from "./conditional";

// The Getting-started checklist — the home page's one front door for a new player:
// an opt-in tour of how Plinky works, each step completed by doing it and
// deep-linking to where you do it. The two set-up steps come first (a hand size and
// key mapping tailor everything after), then the hands-on steps — and the ones that
// put fingers on keys right away carry a "jump right in" pill, the shortcut for
// anyone who'd rather play first and configure later. The ✕ dismisses it for good
// (for fast starters), and it hides itself once every step is done. The played
// step's link is resolved at render time, so `to` here is only its fallback.
const DISCOVERY: {
    key: DiscoveryId;
    icon: string;
    label: () => string;
    to: string;
    quick?: boolean;
}[] = [
    { key: "midiConnected", icon: "🔌", label: m.discover_midi, to: "/settings" },
    { key: "handSet", icon: "✋", label: m.grades_start_hand, to: "/settings" },
    { key: "keysCustomized", icon: "⌨️", label: m.discover_keys, to: "/settings" },
    {
        key: "played",
        icon: "🎹",
        label: m.grades_start_play,
        to: `/play/${FIRST_SONG_ID}`,
        quick: true,
    },
    { key: "dailyDone", icon: "📅", label: m.grades_start_daily, to: "/daily", quick: true },
    { key: "earTried", icon: "👂", label: m.discover_ear, to: `/play/${FIRST_SONG_ID}?mode=ear` },
    {
        key: "fingeringTried",
        icon: "🎯",
        label: m.discover_fingering,
        to: `/play/${FIRST_SONG_ID}?mode=fingering`,
    },
    { key: "composed", icon: "🎼", label: m.discover_compose, to: "/compose" },
    { key: "imported", icon: "📥", label: m.discover_import, to: "/library?tab=manage" },
];

const DISCOVERY_DISMISSED = "discovery-panel";
const LINK = linkClasses;

// The fresh-visitor state: nothing done, nothing dismissed. Rendering it by default
// puts the checklist into the prerendered shell, so the common first visit sees it in
// the first paint with no layout shift.
const FRESH: Record<DiscoveryId, boolean> = Object.fromEntries(
    DISCOVERY.map((step) => [step.key, false]),
) as Record<DiscoveryId, boolean>;

export function DiscoveryChecklist() {
    // Shown in its fresh state by default: completion and dismissal live in
    // localStorage, absent at prerender, so a true newcomer — the state every
    // prerender captures — gets the checklist in the static shell. A returning
    // player's real progress (or dismissal) is reconciled on the client after mount.
    const [state, setState] = useState<{
        done: Record<DiscoveryId, boolean>;
        progress: DiscoveryProgress;
        dismissed: boolean;
        // Where "play your first piece" leads: the first step of the player's first
        // assignment when they have one, a single demo tune otherwise.
        playTo: string;
    }>({
        done: FRESH,
        progress: discoveryProgress(FRESH),
        dismissed: false,
        playTo: `/play/${FIRST_SONG_ID}`,
    });

    const prefsStore = usePrefsStore();
    const masteryStore = useMasteryStore();
    const historyStore = useHistoryStore();
    const daily = useDailyStore();
    const onboarding = useOnboardingStore();
    const hints = useHintsStore();
    const assignmentsStore = useAssignmentsStore();
    // A plugged-in piano completes the connect step wherever it happens — the
    // provider reconnects a remembered device on any page, so the mark can't
    // depend on visiting Settings.
    const midiConnected = useMidiConnected();
    useEffect(() => {
        if (midiConnected) {
            onboarding.markDiscovered("midiConnected");
        }
    }, [midiConnected, onboarding]);
    useEffect(() => {
        const done = discoveries({
            prefs: prefsStore.load(),
            masteredCount: masteryStore.loadAll().length,
            history: historyStore.load(),
            lastDaily: daily.lastDone(),
            marked: onboarding.marked(),
        });
        const firstItem = assignmentsStore.list()[0]?.items[0];
        setState({
            done,
            progress: discoveryProgress(done),
            dismissed: hints.seen(DISCOVERY_DISMISSED),
            playTo: firstItem ? `/play/${firstItem.id}` : `/play/${FIRST_SONG_ID}`,
        });
        // midiConnected re-runs this after a live connect marks the step, so the
        // tick appears without a remount.
    }, [
        prefsStore,
        masteryStore,
        historyStore,
        daily,
        onboarding,
        hints,
        assignmentsStore,
        midiConnected,
    ]);

    if (state.dismissed || state.progress.allDone) {
        return null;
    }

    const dismiss = () => {
        hints.markSeen(DISCOVERY_DISMISSED);
        setState((prev) => ({ ...prev, dismissed: true }));
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
                                to={step.key === "played" ? state.playTo : step.to}
                                className={
                                    stepDone
                                        ? "text-gray-500 line-through dark:text-gray-400"
                                        : LINK
                                }
                            >
                                {step.label()}
                            </Link>
                            {/* The shortcut marker for the itchy-fingered: these
                            steps start you playing immediately, no set-up needed. */}
                            <Show when={step.quick && !stepDone}>
                                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                                    {m.discover_jump_in()}
                                </span>
                            </Show>
                        </li>
                    );
                })}
            </ul>
        </section>
    );
}
