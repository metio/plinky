// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { PartOfDay } from "../../../core/greeting";

// The flower beside the greeting: one plant, drawn differently for each part of the day.
//
// It opens in the morning, turns toward the light through the afternoon, folds in the
// evening, and at night stays closed while a note falls to it. So the thing next to
// "Sunday night" is telling you something true about when you came, rather than decorating
// the words.
//
// The petals arrive one at a time, each in its own colour. That is what makes it an event
// on arrival instead of a picture that was always there — and the five colours are the only
// five in the app that mean nothing at all, which took some finding: nearly every hue here
// is already saying something, and a decorative green beside the green that means "you
// played it right" would be a lie.
//
// Everything is CSS. Nothing is fetched, nothing schedules a frame, and under
// `motion-reduce` the plant simply stands there fully grown.
const PETALS = ["bg-spark", "bg-bloom-leaf", "bg-bloom-sky", "bg-plink", "bg-bloom-rose"];

export function GreetingFlower({ when }: { when: PartOfDay }) {
    const open = when === "morning";
    const turning = when === "afternoon";
    const folding = when === "evening";
    const asleep = when === "night";
    return (
        <span aria-hidden="true" className="relative block size-20 shrink-0">
            <span className="absolute inset-x-[14%] bottom-2 h-px bg-line" />
            <span
                className={`absolute bottom-2 left-1/2 h-9 w-0.5 -translate-x-1/2 origin-bottom rounded-full bg-bloom-leaf ${
                    open ? "animate-stem-grow motion-reduce:animate-none" : ""
                }`}
            />
            <span
                className={`absolute bottom-11 left-1/2 ${
                    turning ? "animate-bloom-sway motion-reduce:animate-none" : ""
                } ${folding ? "animate-bloom-fold motion-reduce:animate-none" : ""} ${
                    asleep ? "scale-[.62]" : ""
                }`}
            >
                {PETALS.map((colour, at) => (
                    <span
                        key={colour}
                        className={`absolute -left-2 -top-4 size-4 h-5 origin-[50%_100%] rounded-full ${colour} animate-petal-in motion-reduce:animate-none`}
                        style={{
                            // Each petal takes its turn around the centre, and its turn in
                            // time: a negative delay starts the cycle already under way, so
                            // the first frame is a flower rather than a bare stem.
                            ["--turn" as string]: `${at * 72}deg`,
                            transform: `rotate(${at * 72}deg) translateY(-22%)`,
                            animationDelay: `-${at * 0.45}s`,
                        }}
                    />
                ))}
                <span className="absolute -left-1 -top-1 size-2 rounded-full bg-surface" />
            </span>
            {asleep && (
                // A note falls to the sleeping plant — the app's own gesture, at the hour
                // when nothing else on the page is moving.
                <span className="absolute left-1/2 size-1.5 -translate-x-1/2 rounded-full bg-plink animate-note-fall motion-reduce:hidden" />
            )}
        </span>
    );
}
