// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The treadmill: notes descending a lane onto a strike line, which is the picture a player
// watches while they play. Running it with no score behind it is what the app does while it
// is busy, so a wait looks like the thing being waited for.
//
// Nothing here is fetched or decoded — it is a handful of coloured boxes and one CSS
// animation, so it is on screen in the same frame as the panel around it. That matters:
// a loading indicator that has to load is no use at the only moment it is needed.
//
// Purely decorative, and silent to assistive technology: a caller that means "work is under
// way" says so in words beside it. Under `motion-reduce` the blocks stand still on the
// lane, which is a legible picture rather than an absence.
//
// The hands keep their own colours — the same two the highway uses — so the thing a player
// already reads as "left" and "right" does not mean something else here.
const LANES = [
    { x: 3, width: 16, height: 22, hand: "left", at: 0 },
    { x: 22, width: 11, height: 14, hand: "left", at: 0.45 },
    { x: 35, width: 16, height: 26, hand: "right", at: 0.9 },
    { x: 54, width: 11, height: 14, hand: "right", at: 1.35 },
    { x: 67, width: 16, height: 18, hand: "right", at: 0.22 },
    { x: 85, width: 12, height: 20, hand: "left", at: 1.12 },
] as const;

// The same lane beside a line of text, where the whole thing is sixteen pixels across.
// Six lanes there is a smudge: each block would be under two pixels wide and the picture
// stops being a picture. Three wide ones still read as blocks falling, which is the only
// part that has to survive at this size.
const FEW = [
    { x: 6, width: 26, height: 26, hand: "left", at: 0 },
    { x: 38, width: 26, height: 20, hand: "right", at: 0.8 },
    { x: 70, width: 26, height: 30, hand: "right", at: 1.5 },
] as const;

export function Treadmill({ compact = false, className = "" }: TreadmillProps) {
    return (
        <span
            aria-hidden="true"
            className={`relative block overflow-hidden rounded-md bg-subtle ${className}`}
        >
            {(compact ? FEW : LANES).map((lane) => (
                <span
                    key={`${lane.x}-${lane.at}`}
                    className={`absolute rounded-sm shadow-sm animate-treadmill motion-reduce:animate-none ${
                        lane.hand === "left" ? "bg-hand-left-soft" : "bg-hand-right-soft"
                    }`}
                    style={{
                        left: `${lane.x}%`,
                        width: `${lane.width}%`,
                        height: `${lane.height}%`,
                        // A negative delay starts each lane part-way through, so the first
                        // frame is already a full lane rather than an empty one filling up.
                        animationDelay: `-${lane.at}s`,
                    }}
                />
            ))}
            {/* The strike line: where a block meets its key. */}
            <span className="pointer-events-none absolute inset-x-0 bottom-0 h-0.5 bg-accent-soft/70" />
        </span>
    );
}

export type TreadmillProps = {
    // Beside a line of text rather than filling a panel: fewer, wider lanes, because six
    // in sixteen pixels is a smudge.
    compact?: boolean;
    className?: string;
};
