// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { m } from "../../paraglide/messages.js";
import { CoachMark } from "./coachMark";
import { SegmentedControl } from "../ui/segmentedControl";

// The ways to work a piece. "play" is the score itself — reading, hearing,
// practising, and (inside full screen) the ear and fingering drills that used to
// be tabs of their own; "runs" is your saved performances — replays, ghosts and
// exports, with the whole page to breathe. They share the open piece, so
// switching never leaves the page.
export type PlayMode = "play" | "runs";

const MODES: { id: PlayMode; label: () => string }[] = [
    { id: "play", label: m.mode_play },
    { id: "runs", label: m.mode_runs },
];

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
        onChange(next);
    };
    return (
        <div className="space-y-2">
            <div className="sticky top-0 z-10 -mx-6 border-b border-gray-200 bg-white/90 px-6 py-2 backdrop-blur dark:border-gray-800 dark:bg-gray-950/90">
                <SegmentedControl
                    options={MODES.map((tab) => ({ id: tab.id, label: tab.label() }))}
                    value={mode}
                    onChange={select}
                    label={m.mode_label()}
                />
            </div>
            <CoachMark id="play-modes">{m.coach_play_modes()}</CoachMark>
            {mode === "play" && <CoachMark id="practice-loop">{m.coach_practice_loop()}</CoachMark>}
        </div>
    );
}
