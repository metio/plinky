// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { markDiscovered } from "../lib/onboarding";
import { m } from "../paraglide/messages.js";
import { CoachMark } from "./coachMark";

// The ways to work a piece. "play" is the score itself (read it, hear it, practise
// it); "ear" and "fingering" are the focused drills. They share the open piece, so
// switching never leaves the page.
export type PlayMode = "play" | "ear" | "fingering";

const MODES: { id: PlayMode; label: () => string }[] = [
    { id: "play", label: m.mode_play },
    { id: "ear", label: m.mode_ear },
    { id: "fingering", label: m.mode_fingering },
];

const ACTIVE = "rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white";
const INACTIVE =
    "rounded-md px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800";

// A slim tab bar that sticks to the top while you scroll a long score, so the modes
// and their controls stay one tap away.
export function PlayModeBar({
    mode,
    onChange,
}: {
    mode: PlayMode;
    onChange: (mode: PlayMode) => void;
}) {
    const select = (next: PlayMode) => {
        if (next === "ear") {
            markDiscovered("earTried");
        } else if (next === "fingering") {
            markDiscovered("fingeringTried");
        }
        onChange(next);
    };
    return (
        <div className="space-y-2">
            <div className="sticky top-0 z-10 -mx-6 border-b border-gray-200 bg-white/90 px-6 py-2 backdrop-blur dark:border-gray-800 dark:bg-gray-950/90">
                <div role="tablist" aria-label={m.mode_label()} className="flex flex-wrap gap-1">
                    {MODES.map((tab) => (
                        <button
                            key={tab.id}
                            type="button"
                            role="tab"
                            aria-selected={mode === tab.id}
                            onClick={() => select(tab.id)}
                            className={mode === tab.id ? ACTIVE : INACTIVE}
                        >
                            {tab.label()}
                        </button>
                    ))}
                </div>
            </div>
            <CoachMark id="play-modes">{m.coach_play_modes()}</CoachMark>
        </div>
    );
}
