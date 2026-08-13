// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useEffect, useState } from "react";
import {
    useDailyStore,
    useHintsStore,
    useHistoryStore,
    useMasteryStore,
    useOnboardingStore,
    usePlacementStore,
    usePrefsStore,
} from "../../contexts/services";
import {
    type DiscoveryId,
    type DiscoveryProgress,
    discoveries,
    discoveryProgress,
} from "../../../core/onboarding";
import { m } from "../../paraglide/messages.js";
import { CheckIcon, CloseIcon } from "../ui/icons";
import { linkClasses } from "../ui/classes";
import { useMidiConnected } from "./conditional";
import { LocalizedLink as Link } from "../ui/localizedLink";

// Setting yourself up: the three things that tailor everything after them — a piano
// (or a microphone) to play on, how far your hands reach, and which computer keys
// carry which notes. None of it is a gate, and none of it is a tour of the app's
// features: the day's practice already offers those, and a second list of suggestions
// beside it would only ask the reader to choose which list to read.
//
// The ✕ dismisses it for good, and it hides itself once all three are done.
const DISCOVERY: {
    key: DiscoveryId;
    icon: string;
    label: () => string;
    to: string;
}[] = [
    { key: "midiConnected", icon: "🔌", label: m.discover_midi, to: "/settings" },
    { key: "handSet", icon: "✋", label: m.grades_start_hand, to: "/settings" },
    { key: "keysCustomized", icon: "⌨️", label: m.discover_keys, to: "/settings" },
];

const DISCOVERY_DISMISSED = "discovery-panel";
const LINK = linkClasses;

// The fresh-visitor state: nothing done, nothing dismissed. Rendering it by default
// puts the strip into the prerendered shell, so the common first visit sees it in
// the first paint with no layout shift.
const FRESH: Record<DiscoveryId, boolean> = Object.fromEntries(
    DISCOVERY.map((step) => [step.key, false]),
) as Record<DiscoveryId, boolean>;

// Only the steps shown here decide whether the strip has anything left to say — the
// rest of the discovery record tracks corners of the app that the day's practice
// offers on its own.
function setupProgress(done: Record<DiscoveryId, boolean>): DiscoveryProgress {
    return discoveryProgress(
        Object.fromEntries(DISCOVERY.map((step) => [step.key, done[step.key] === true])) as Record<
            DiscoveryId,
            boolean
        >,
    );
}

export function DiscoveryChecklist() {
    // Shown in its fresh state by default: completion and dismissal live in
    // localStorage, absent at prerender, so a true newcomer — the state every
    // prerender captures — gets the strip in the static shell. A returning
    // player's real progress (or dismissal) is reconciled on the client after mount.
    const [state, setState] = useState<{
        done: Record<DiscoveryId, boolean>;
        progress: DiscoveryProgress;
        dismissed: boolean;
    }>({
        done: FRESH,
        progress: setupProgress(FRESH),
        dismissed: false,
    });

    const prefsStore = usePrefsStore();
    const masteryStore = useMasteryStore();
    const historyStore = useHistoryStore();
    const daily = useDailyStore();
    const onboarding = useOnboardingStore();
    const placement = usePlacementStore();
    const hints = useHintsStore();
    // A plugged-in piano completes the connect step wherever it happens — the
    // provider reconnects a remembered device on any page, so the mark can't
    // depend on visiting Settings. Marked before the read below, so a live
    // connect ticks the step in the same pass.
    const midiConnected = useMidiConnected();
    useEffect(() => {
        if (midiConnected) {
            onboarding.markDiscovered("midiConnected");
        }
        const done = discoveries({
            prefs: prefsStore.load(),
            masteredCount: masteryStore.loadAll().length,
            history: historyStore.load(),
            lastDaily: daily.lastDone(),
            placementTaken: placement.load() !== null,
            marked: onboarding.marked(),
        });
        setState({
            done,
            progress: setupProgress(done),
            dismissed: hints.seen(DISCOVERY_DISMISSED),
        });
    }, [
        prefsStore,
        masteryStore,
        historyStore,
        daily,
        onboarding,
        placement,
        hints,
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
        <section className="space-y-3 rounded-md border border-accent-line bg-accent-surface/50 p-4 dark:bg-accent-surface/30">
            <div className="flex items-start justify-between gap-2">
                <h2 className="font-semibold text-accent-deep">{m.discover_heading()}</h2>
                <button
                    type="button"
                    onClick={dismiss}
                    aria-label={m.action_dismiss()}
                    className="shrink-0 p-1 leading-none text-accent-strong"
                >
                    <CloseIcon className="h-4 w-4" />
                </button>
            </div>
            <ul className="space-y-1.5 text-sm">
                {DISCOVERY.map((step) => {
                    const stepDone = state.done[step.key];
                    return (
                        <li key={step.key} className="flex items-center gap-2">
                            <span
                                aria-hidden="true"
                                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                                    stepDone
                                        ? "bg-success-solid text-white"
                                        : "border border-line-strong"
                                }`}
                            >
                                {stepDone && <CheckIcon className="h-3.5 w-3.5" />}
                            </span>
                            <span aria-hidden="true">{step.icon}</span>
                            <Link
                                to={step.to}
                                className={stepDone ? "text-muted line-through" : LINK}
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
