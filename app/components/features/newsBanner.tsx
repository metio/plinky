// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useEffect, useRef, useState } from "react";
import { useHintsStore, useScheduler } from "../../contexts/services";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import { useNews } from "../../hooks/useNews";
import { m } from "../../paraglide/messages.js";
import { ChevronIcon, CloseIcon } from "../ui/icons";

// A small "what's new" slot on the home page: editor-published pictures that each
// link somewhere, fetched live from the content service so they change without a
// redeploy. Renders nothing until (and unless) an item resolves, so a fetch
// failure or an unconfigured source is invisible. The ✕ dismisses one item for
// good — dismissal is keyed by the item's id (reusing the seen-hints store), so a
// newly published item shows again.
//
// With more than one shown item it becomes a gentle carousel: it advances on its
// own every ROTATE_MS, and a reader can step through it by chevron, dot, or swipe.
// The moment they navigate by hand, auto-advance stops for the rest of the visit —
// they went looking for something, and pulling the page out from under them would
// be exactly the kind of nagging Plinky avoids.

// How long each item lingers before the carousel advances on its own. Long enough
// to read a headline, unhurried on purpose.
const ROTATE_MS = 7000;
// A horizontal drag past this many pixels counts as a swipe, not a tap on the
// link — small enough to feel responsive, large enough that a jittery tap doesn't
// trip it.
const SWIPE_PX = 40;
// The banner's fixed shape. Every item's box takes this ratio, so a rotation never
// resizes it (no page jump) and the box is reserved before the first picture loads
// (no shift on load). object-cover fills it, so a picture that IS this ratio shows
// in full with no crop and no empty sides — publish news images at 16:9 (e.g.
// 1600×900) and they display perfectly; an off-ratio one is cropped to fit.
const BANNER_ASPECT = "16 / 9";

export function NewsBanner() {
    const items = useNews();
    const hints = useHintsStore();
    const scheduler = useScheduler();
    const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
    const [dismissed, setDismissed] = useState<ReadonlySet<string>>(() => new Set());
    // Which item shows, as an ever-incrementing counter taken modulo the visible
    // count — so it stays valid as items are dismissed and the list shrinks.
    const [index, setIndex] = useState(0);
    // Once the reader steps through by hand they are reading, not glancing, so
    // auto-advance stops for the rest of the visit and never steals their place.
    const [paused, setPaused] = useState(false);
    // Where a pointer press began, so pointer-up can tell a swipe from a tap and,
    // on a swipe, keep the tap from also following the link.
    const pressX = useRef<number | null>(null);
    const swiped = useRef(false);

    const visible = items.filter((it) => !dismissed.has(it.id) && !hints.seen(`news:${it.id}`));
    const count = visible.length;
    const current = count === 0 ? 0 : index % count;

    // Auto-advance only while there is more than one item, the reader has not taken
    // over, and the device isn't asking for reduced motion. The scheduler seam lets
    // a test drive the timer with a virtual clock.
    useEffect(() => {
        if (paused || reducedMotion || count < 2) {
            return;
        }
        const handle = scheduler.every(ROTATE_MS, () => setIndex((i) => i + 1));
        return () => scheduler.cancel(handle);
    }, [scheduler, paused, reducedMotion, count]);

    if (count === 0) {
        return null;
    }
    const item = visible[current];
    if (!item) {
        return null;
    }

    // Manual navigation: land on the chosen item and stop auto-advancing. The
    // offset arithmetic keeps the counter positive so a step back from the first
    // item wraps to the last.
    const goTo = (next: number) => {
        setIndex(((next % count) + count) % count);
        setPaused(true);
    };
    const step = (delta: number) => goTo(current + delta);

    const dismiss = () => {
        hints.markSeen(`news:${item.id}`);
        setDismissed((prev) => new Set(prev).add(item.id));
        // The list shrinks under the same counter, surfacing the neighbouring item
        // in this slot — no index juggling, and dismissing isn't "reading", so
        // auto-advance keeps running.
    };

    const onPointerDown = (event: React.PointerEvent) => {
        pressX.current = event.clientX;
        swiped.current = false;
    };
    const onPointerUp = (event: React.PointerEvent) => {
        const start = pressX.current;
        pressX.current = null;
        if (start === null || count < 2) {
            return;
        }
        const dx = event.clientX - start;
        if (Math.abs(dx) >= SWIPE_PX) {
            swiped.current = true;
            step(dx < 0 ? 1 : -1);
        }
    };
    // A drag that ended as a swipe must not also follow the link it dragged across.
    const onClickCapture = (event: React.MouseEvent) => {
        if (swiped.current) {
            event.preventDefault();
            swiped.current = false;
        }
    };

    const pill =
        "rounded-full bg-black/40 p-1 leading-none text-white backdrop-blur transition hover:bg-black/60 focus-visible:bg-black/60";

    return (
        <section
            aria-label={m.news_label()}
            className="group relative overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900"
        >
            <div
                className="relative w-full touch-pan-y bg-gray-100 dark:bg-gray-800"
                style={{ aspectRatio: BANNER_ASPECT }}
                onPointerDown={onPointerDown}
                onPointerUp={onPointerUp}
                onClickCapture={onClickCapture}
            >
                {/* The box holds one ratio for every item, so a rotation never
                    resizes it; object-cover fills the box completely — no empty
                    sides — cropping a hair only when a ratio differs. */}
                <a
                    href={item.linkUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block h-full w-full"
                    aria-label={item.headline || item.imageAlt}
                >
                    <img
                        src={item.imageUrl}
                        alt={item.imageAlt}
                        loading="lazy"
                        draggable={false}
                        className="h-full w-full object-cover"
                    />
                </a>

                <button
                    type="button"
                    onClick={dismiss}
                    aria-label={m.action_dismiss()}
                    className={`absolute right-2 top-2 z-10 ${pill}`}
                >
                    <CloseIcon className="h-4 w-4" />
                </button>

                {count > 1 && (
                    <>
                        <button
                            type="button"
                            onClick={() => step(-1)}
                            aria-label={m.news_previous()}
                            className={`absolute left-2 top-1/2 z-10 -translate-y-1/2 ${pill}`}
                        >
                            <ChevronIcon className="h-4 w-4 rotate-180" />
                        </button>
                        <button
                            type="button"
                            onClick={() => step(1)}
                            aria-label={m.news_next()}
                            className={`absolute right-2 top-1/2 z-10 -translate-y-1/2 ${pill}`}
                        >
                            <ChevronIcon className="h-4 w-4" />
                        </button>
                        {/* Position as struck notes: the current item is an indigo
                            "plink" bar, the rest muted dots, on a translucent pill
                            so they read over any picture. */}
                        <div className="absolute inset-x-0 bottom-2 z-10 flex justify-center">
                            <div className="flex items-center gap-1.5 rounded-full bg-black/35 px-2 py-1.5 backdrop-blur">
                                {visible.map((it, i) => (
                                    <button
                                        key={it.id}
                                        type="button"
                                        onClick={() => goTo(i)}
                                        aria-label={m.news_go_to({ position: i + 1 })}
                                        aria-current={i === current}
                                        className="flex h-3 items-center px-0.5"
                                    >
                                        <span
                                            className={`h-1.5 rounded-full motion-safe:transition-all ${
                                                i === current
                                                    ? "w-4 bg-indigo-300"
                                                    : "w-1.5 bg-white/45"
                                            }`}
                                        />
                                    </button>
                                ))}
                            </div>
                        </div>
                    </>
                )}
            </div>

            {item.headline && (
                <a
                    href={item.linkUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block px-4 py-3 text-sm font-medium text-gray-800 transition group-hover:text-indigo-700 dark:text-gray-100 dark:group-hover:text-indigo-300"
                >
                    {item.headline}
                </a>
            )}
        </section>
    );
}
