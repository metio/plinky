// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { keybedMaxWidthPx, keyLane } from "../../../core/keyboardGeometry";
import type { UpcomingStep } from "../../../core/matcher";
import { m } from "../../paraglide/messages.js";

// The notes highway: the upcoming notes as blocks stacked in their key's lane
// above the on-screen keyboard, the imminent one flush at the bottom against the
// keys and later ones climbing away, so a beginner can see which key comes next —
// and read the shape of the run — without decoding the staff. It advances by
// position, not a clock (a cleared note drops out and the stack slides down),
// which suits self-paced practice and keeps the grade untouched. Blocks land on
// the same lanes the keyboard draws (shared `keyLane` geometry), and the panel
// caps + centres to the same width so the columns line up with the keys below.

// Left-hand notes read teal, everything else (right hand, or a chord spanning both)
// reads the same indigo the keyboard lights the expected key with, for continuity.
// Depth is a lighter *shade* per tier (nearest → furthest), NOT the CSS `opacity`
// property: an opacity layer triggers a headless-Chromium compositing artifact that
// drops a block's blue channel and would flake the story baselines. Full static class
// strings so Tailwind (and the class gate) pick them up.
// The `hand-*` tokens resolve to the 300/500 shades on purpose, and the two tiers
// swap which is which per theme. The 400/600 shades hit a headless-Chromium
// OKLCH→sRGB gamut clip that zeroes their blue channel (rendering indigo as yellow)
// and would bake a wrong colour into the baselines; real browsers render 400 fine,
// but the pinned baseline browser does not, so those shades stay out of these lanes.
const SHADES = {
    right: ["bg-hand-right", "bg-hand-right-soft"],
    left: ["bg-hand-left", "bg-hand-left-soft"],
};

// The hand that plays THIS note, not the hands the position involves. Taken per pitch
// because a chord spanning the grand staff is the common case — 41% of positions in the
// catalogue — and colouring it all one hand tells the reader the opposite of what the
// two colours are for.
function blockClass(hand: "left" | "right" | undefined, row: number): string {
    const tier = row === 0 ? 0 : 1;
    return SHADES[hand ?? "right"][tier]!;
}

export function NotesHighway({
    upcoming,
    from,
    to,
    rows = 8,
}: {
    upcoming: UpcomingStep[];
    from: number;
    to: number;
    // How many positions of look-ahead to stack across the panel's height.
    rows?: number;
}) {
    const rowPct = 100 / rows;
    const maxWidth = keybedMaxWidthPx(from, to);

    return (
        // Fills its container's height and caps + centres to the keybed width, so a tall
        // panel above the keys reads as a lane the notes descend toward the strike line.
        <div
            aria-label={m.highway_label()}
            role="img"
            className="mx-auto h-full w-full"
            style={{ maxWidth }}
        >
            <div className="relative h-full w-full overflow-hidden rounded-md bg-subtle">
                {upcoming.slice(0, rows).flatMap((step, row) =>
                    step.pitches.map((pitch, note) => {
                        const lane = keyLane(pitch, from, to);
                        if (!lane) {
                            return null;
                        }
                        return (
                            <span
                                key={`${step.index}-${pitch}`}
                                aria-hidden="true"
                                className={`absolute rounded-sm shadow-sm transition-[bottom] duration-200 ease-out motion-reduce:transition-none ${blockClass(step.pitchHands[note], row)}`}
                                style={{
                                    left: `${lane.leftPct}%`,
                                    width: `${lane.widthPct}%`,
                                    bottom: `${row * rowPct}%`,
                                    height: `${rowPct - 2}%`,
                                }}
                            />
                        );
                    }),
                )}
                {/* The strike line: where a block meets its key. */}
                <span
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-x-0 bottom-0 h-0.5 bg-accent-soft/70"
                />
            </div>
        </div>
    );
}
