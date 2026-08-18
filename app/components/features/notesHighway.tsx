// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { keybedMaxWidthPx, keyLane } from "../../../core/keyboardGeometry";
import type { UpcomingStep } from "../../../core/matcher";
import { m } from "../../paraglide/messages.js";

// The notes highway: the upcoming notes as blocks in their key's lane above the
// on-screen keyboard, the imminent one flush at the bottom against the keys and later
// ones climbing away, so a beginner can see which key comes next — and read the shape
// of the run — without decoding the staff. Blocks land on the same lanes the keyboard
// draws (shared `keyLane` geometry), and the panel caps + centres to the same width so
// the columns line up with the keys below.
//
// A block is as tall as its note is long, and sits as far above the strike line as it is
// far off in the music. This is the whole point of a falling-note picture: it is the one
// reading aid that shows LENGTH, so a whole note held under a run of quavers has to stand
// over them. Drawn a row per position instead, every note is the same block and a piece
// of music reads as a list of keys to press.
//
// What it still does NOT do is run on a clock. The origin is the position the player is
// on, so nothing falls until a note is cleared and the stack slides down — self-paced
// practice, and the grade untouched. Time sets the scale, not the motion.
//
// The clock is the step model's own, at the written tempi, and the holds come off it
// too, so the two are in the same units whatever the practice dial says. A slower dial
// stretches both together and the picture keeps its proportions.

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
function blockClass(hand: "left" | "right" | undefined, imminent: boolean): string {
    return SHADES[hand ?? "right"][imminent ? 0 : 1]!;
}

// A note shorter than this still needs to be seen: a grace note is a few milliseconds
// and would otherwise draw as nothing at all.
const MIN_BLOCK_PCT = 1.5;

// Enough to part two notes that touch, so a legato run of crotchets reads as crotchets
// rather than as one long column.
const GAP_PCT = 0.8;

export function NotesHighway({
    upcoming,
    from,
    to,
    windowMs = 4_000,
}: {
    upcoming: UpcomingStep[];
    from: number;
    to: number;
    // How much music the panel's height spans, in the step model's milliseconds. This is
    // a zoom, not a speed — nothing moves on its own — so it decides how much of what is
    // coming fits above the keys, and a note's share of it is its share of the height.
    //
    // Deliberately its own number rather than the video export's window, which looks like
    // the same knob and is not: that one runs on a clock, where the window is how far
    // ahead you see and tuning it changes how fast the picture moves. Tying them together
    // would let a change to the look of an export quietly rescale practice.
    windowMs?: number;
}) {
    // The position the player is on sits at the strike line, and everything else is
    // measured from it. Not a clock reading: this is what keeps the picture still until
    // a note is cleared.
    const origin = upcoming[0]?.atMs ?? 0;
    const span = Math.max(1, windowMs);
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
                {upcoming.flatMap((step, row) => {
                    const bottom = ((step.atMs - origin) / span) * 100;
                    // Past the top of the panel there is nothing to draw. The look-ahead
                    // is counted in positions and the panel measured in time, so how many
                    // of them fit depends on the music — a run of semiquavers puts far
                    // more of itself on screen than a line of minims.
                    if (bottom >= 100) {
                        return [];
                    }
                    return step.pitches.map((pitch, note) => {
                        const lane = keyLane(pitch, from, to);
                        if (!lane) {
                            return null;
                        }
                        const length = ((step.pitchHoldsMs[note] ?? 0) / span) * 100;
                        return (
                            <span
                                key={`${step.index}-${pitch}`}
                                aria-hidden="true"
                                className={`absolute rounded-sm shadow-sm transition-[bottom] duration-200 ease-out motion-reduce:transition-none ${blockClass(step.pitchHands[note], row === 0)}`}
                                style={{
                                    left: `${lane.leftPct}%`,
                                    width: `${lane.widthPct}%`,
                                    bottom: `${bottom}%`,
                                    height: `${Math.max(MIN_BLOCK_PCT, length - GAP_PCT)}%`,
                                }}
                            />
                        );
                    });
                })}
                {/* The strike line: where a block meets its key. */}
                <span
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-x-0 bottom-0 h-0.5 bg-accent-soft/70"
                />
            </div>
        </div>
    );
}
