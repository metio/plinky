// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { PartOfDay } from "../../../core/greeting";

// The small drawing beside the greeting: one per part of the day, so the thing next to
// "Sunday night" is telling you something true about when you came rather than decorating
// the words.
//
// A sun in the morning, the flower through the afternoon, balloons in the evening, sparkles
// at night. Warm and awake, then growing, then buoyant, then quiet — the day's own shape.
//
// Every one is CSS and SVG: nothing is fetched, nothing schedules a frame, and each occupies
// the same 80×80 box so the greeting never changes height as the hours pass. Under
// `motion-reduce` they all simply stand still, fully drawn.
//
// The colours are the five the app keeps for decoration — the only five that mean nothing
// else. Every hue that carries a meaning somewhere (green for right, red for wrong, the
// grade bands) stays out, so nobody has to wonder whether a pink balloon is telling them
// something.

const PETALS = ["bg-bloom-sun", "bg-bloom-leaf", "bg-bloom-sky", "bg-plink", "bg-bloom-rose"];

// How long the stalk takes to draw itself, in seconds. The petals wait it out, so this has
// to agree with `--animate-stem-draw` in app.css — the two are one gesture split across a
// stylesheet and a component, and a petal opening on a half-grown stem is what disagreement
// looks like.
const STEM_SECONDS = 1.15;

// The rays, by angle and colour. Gold, flame and pink rather than eight of one hue: a ring
// of identical spokes reads as a clock face.
//
// These are the bloom colours rather than `spark`, which looks like the right gold and is
// not available: spark is the grade-S colour and the "warm up" heading, so brightening it to
// sunlight would drop its contrast wherever it is set as text.
const RAYS: [number, string][] = [
    [0, "bg-bloom-sun"],
    [45, "bg-bloom-flame"],
    [90, "bg-bloom-rose"],
    [135, "bg-bloom-sun"],
    [180, "bg-bloom-flame"],
    [225, "bg-bloom-sun"],
    [270, "bg-bloom-rose"],
    [315, "bg-bloom-sun"],
];

function Sun() {
    return (
        <span className="absolute inset-0 animate-sun-bob motion-reduce:animate-none">
            {RAYS.map(([angle, colour], at) => (
                <span
                    key={angle}
                    className={`absolute left-1/2 top-1/2 -ml-[3px] -mt-[6px] h-3 w-1.5 rounded-full ${colour} animate-ray-breathe motion-reduce:animate-none`}
                    style={{
                        // Each ray breathes on its own offset. Eight in step is a pulsing
                        // badge; eight apart is sunlight.
                        ["--ray-turn" as string]: `${angle}deg`,
                        transform: `rotate(${angle}deg) translateY(-22px)`,
                        animationDelay: `-${(at * 0.31).toFixed(2)}s`,
                    }}
                />
            ))}
            <span className="absolute left-1/2 top-1/2 -ml-[17px] -mt-[17px] size-[34px] rounded-full bg-bloom-sun" />
        </span>
    );
}

function Flower() {
    return (
        <>
            {/* Stem and head share the element that carries the sway, so the head leans with
                the stalk rather than hanging beside it, and the petals inherit the lean. */}
            <span className="absolute inset-0 origin-bottom animate-stem-sway motion-reduce:animate-none">
                <svg
                    viewBox="0 0 24 40"
                    className="absolute bottom-2 left-1/2 h-9 w-6 -translate-x-1/2 text-bloom-leaf"
                >
                    <title>stem</title>
                    <path
                        d="M12 39 Q 7.5 21 12 3"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        pathLength={1}
                        style={{ strokeDasharray: 1, strokeDashoffset: 0 }}
                        className="animate-stem-draw motion-reduce:animate-none"
                    />
                </svg>
                <span className="absolute bottom-11 left-1/2 animate-head-rise motion-reduce:animate-none">
                    {/* The head leans a degree further than the stalk, which is what weight
                        on the end of a stem does. */}
                    <span className="absolute animate-head-sway motion-reduce:animate-none">
                        {PETALS.map((colour, at) => (
                            <span
                                key={colour}
                                className={`absolute -left-2 -top-4 size-4 h-5 origin-[50%_100%] rounded-full ${colour} animate-petal-in motion-reduce:animate-none`}
                                style={{
                                    ["--turn" as string]: `${at * 72}deg`,
                                    transform: `rotate(${at * 72}deg) translateY(-22%)`,
                                    animationDelay: `${STEM_SECONDS + at * 0.13}s`,
                                }}
                            />
                        ))}
                        <span className="absolute -left-1 -top-1 size-2 rounded-full bg-surface" />
                    </span>
                </span>
            </span>
            {/* A note falls to the flower — the app's own gesture, and the one thing here
                nothing else in the set does. */}
            <span className="absolute left-1/2 size-1.5 -translate-x-1/2 rounded-full bg-plink animate-note-fall motion-reduce:hidden" />
        </>
    );
}

// Where each balloon sits, what colour it is, and the colour of its string. Three, at
// different heights and on different offsets, because three balloons rising in step is one
// balloon drawn three times.
const BALLOONS: { colour: string; string: string; left: number; top: number; delay: string }[] = [
    { colour: "bg-bloom-rose", string: "text-bloom-leaf", left: 8, top: 14, delay: "0s" },
    { colour: "bg-plink", string: "text-bloom-sun", left: 26, top: 6, delay: "-1.2s" },
    { colour: "bg-bloom-sky", string: "text-plink", left: 42, top: 16, delay: "-2.4s" },
];

function Balloons() {
    return (
        <span className="absolute inset-0">
            {BALLOONS.map((balloon) => (
                <span key={balloon.colour}>
                    <span
                        className={`absolute h-8 w-[26px] rounded-[50%_50%_48%_48%] ${balloon.colour} animate-balloon-float motion-reduce:animate-none`}
                        style={{
                            left: `${balloon.left}px`,
                            top: `${balloon.top}px`,
                            animationDelay: balloon.delay,
                        }}
                    >
                        {/* The highlight is what makes a coloured oval read as inflated. */}
                        <span className="absolute left-[22%] top-[16%] h-2.5 w-[7px] -rotate-[18deg] rounded-[50%] bg-white/40" />
                    </span>
                    <svg
                        viewBox="0 0 10 26"
                        className={`absolute h-[26px] w-2.5 origin-top ${balloon.string} animate-string-sway motion-reduce:animate-none`}
                        style={{
                            left: `${balloon.left + 11}px`,
                            top: `${balloon.top + 36}px`,
                            animationDelay: balloon.delay,
                        }}
                    >
                        <title>string</title>
                        <path
                            d="M5 0 Q 1 9 5 15 Q 9 21 4 26"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.4"
                            strokeLinecap="round"
                        />
                    </svg>
                </span>
            ))}
        </span>
    );
}

const SPARKS: { left: number; top: number; size: number; colour: string; delay: string }[] = [
    { left: 4, top: 10, size: 20, colour: "text-bloom-sun", delay: "0s" },
    { left: 40, top: 6, size: 17, colour: "text-bloom-rose", delay: "-0.8s" },
    { left: 28, top: 30, size: 18, colour: "text-plink", delay: "-1.6s" },
    { left: 8, top: 42, size: 14, colour: "text-bloom-sky", delay: "-2.2s" },
    { left: 50, top: 38, size: 12, colour: "text-bloom-sun", delay: "-2.8s" },
];

const DOTS: { left: number; top: number; size: number; colour: string; delay: string }[] = [
    { left: 38, top: 2, size: 8, colour: "bg-plink", delay: "-0.4s" },
    { left: 2, top: 34, size: 6, colour: "bg-bloom-rose", delay: "-1.1s" },
    { left: 58, top: 24, size: 6, colour: "bg-accent-soft", delay: "-1.9s" },
    { left: 26, top: 58, size: 8, colour: "bg-bloom-sky", delay: "-2.5s" },
];

function Sparkles() {
    return (
        <span className="absolute inset-0">
            {SPARKS.map((spark) => (
                <svg
                    key={`${spark.left}-${spark.top}`}
                    viewBox="0 0 24 24"
                    className={`absolute ${spark.colour} animate-twinkle motion-reduce:animate-none`}
                    style={{
                        left: `${spark.left}px`,
                        top: `${spark.top}px`,
                        width: `${spark.size}px`,
                        height: `${spark.size}px`,
                        animationDelay: spark.delay,
                    }}
                >
                    <title>sparkle</title>
                    <path
                        fill="currentColor"
                        d="M12 0 C13 8 16 11 24 12 C16 13 13 16 12 24 C11 16 8 13 0 12 C8 11 11 8 12 0 Z"
                    />
                </svg>
            ))}
            {DOTS.map((dot) => (
                <span
                    key={`${dot.left}-${dot.top}`}
                    className={`absolute rounded-full ${dot.colour} animate-twinkle motion-reduce:animate-none`}
                    style={{
                        left: `${dot.left}px`,
                        top: `${dot.top}px`,
                        width: `${dot.size}px`,
                        height: `${dot.size}px`,
                        animationDelay: dot.delay,
                    }}
                />
            ))}
        </span>
    );
}

const SCENES: Record<PartOfDay, () => React.JSX.Element> = {
    morning: Sun,
    afternoon: Flower,
    evening: Balloons,
    night: Sparkles,
};

export function GreetingScene({ when }: { when: PartOfDay }) {
    const Scene = SCENES[when];
    return (
        <span aria-hidden="true" className="relative block size-20 shrink-0">
            <Scene />
        </span>
    );
}
