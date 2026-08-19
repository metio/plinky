// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { setProjectAnnotations } from "@storybook/react-vite";
import { page } from "vitest/browser";
import { afterEach, beforeAll, expect } from "vitest";
import projectAnnotations from "./preview";
import { type Box, descendantBounds, holds, mayDescend } from "../core/storyCrop";

// Apply the preview's decorators and parameters when running stories as tests.
const project = setProjectAnnotations([projectAnnotations]);
beforeAll(project.beforeAll);

// Stories whose visible content includes emoji. Emoji glyphs are the one thing
// that still rasterizes machine-dependently: the preview ships a "Noto Color
// Emoji" webfont, but the OS installs a font of the same family name, the
// webfont is subset by unicode-range, and `document.fonts.check` can't tell
// the two apart — so out-of-subset glyphs silently come from whichever Noto
// version the machine has. These stories still run (render, play functions,
// coverage); only the pixel comparison is skipped.
const EMOJI_STORIES = new Set([
    "gradeBadge.stories.tsx > Starting",
    "gradeBadge.stories.tsx > Earned",
    "gradeBadge.stories.tsx > Competitive Mode",
    "achievementGallery.stories.tsx > Fresh",
    "achievementGallery.stories.tsx > Partly Earned",
    "achievementGallery.stories.tsx > Complete",
    "dailyReveal.stories.tsx > Present",
    "youStanding.stories.tsx > Standing",
    "youStanding.stories.tsx > Competitive",
    "surpriseButton.stories.tsx > Default",
    "loopRangeBar.stories.tsx > Whole Song",
    "loopRangeBar.stories.tsx > Narrowed",
    "loopRangeBar.stories.tsx > One Bar",
    "gradeRoadmap.stories.tsx > Progressing",
    "gradeRoadmap.stories.tsx > Competitive",
]);

// Stories whose thin, absolutely-positioned colour blocks rasterise
// machine-dependently: in light mode the headless-Chromium GPU path clips some
// saturated indigo/teal fills through OKLCH→sRGB with the blue channel zeroed
// (rendering them olive), and which blocks it hits depends on their sub-pixel Y
// position, not their colour class — so a committed baseline would be both wrong
// to the eye and unstable across machines. Real browsers render them correctly.
// These stories still render, run and count for coverage; only the pixel
// comparison is skipped.
const RASTER_UNSTABLE_STORIES = new Set([
    "notesHighway.stories.tsx > Right Hand",
    "notesHighway.stories.tsx > Two Hands",
    "notesHighway.stories.tsx > Chord",
]);

// Resolves once the browser has painted pending style and layout work: the
// first frame runs after the next paint, the second confirms it is on screen.
const painted = () =>
    new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

// The element a story renders into, which is what gets compared.
//
// Storybook keeps four zero-sized `sb-wrapper` divs on the body for its own
// preparing and error displays; the story's container is the remaining one.
//
// Comparing this rather than `document.body` is what makes the comparison mean
// anything. `allowedMismatchedPixelRatio` is a fraction of the frame, so a body
// shot spends it on empty page: at a 800x600 viewport the allowance is a few
// thousand pixels, and a small control — an icon button, a badge, a row — draws
// fewer than that, so it could change beyond recognition and still match. Cropped
// to the story's own bounds, the allowance is a fraction of the component.
const storyRoot = () => {
    const root = document.querySelector("body > div:not(.sb-wrapper)");
    if (!(root instanceof HTMLElement)) {
        throw new Error("no story container on the body");
    }
    return root;
};

const boxOf = (el: Element): Box => el.getBoundingClientRect();

const drawn = (el: Element) => {
    const box = el.getBoundingClientRect();
    return box.width > 0 && box.height > 0;
};

// What an element clips its contents to, if it clips them at all. A collapsed disclosure
// or a scroller draws children the reader cannot see; counting those as content would
// send the crop out to the whole viewport to hold something nobody is looking at.
const clipOf = (el: Element): Box | null => {
    for (let at: Element | null = el.parentElement; at !== null; at = at.parentElement) {
        const style = getComputedStyle(at);
        if (style.overflow !== "visible" || style.overflowX !== "visible") {
            return boxOf(at);
        }
    }
    return null;
};

const intersects = (one: Box, other: Box): boolean =>
    one.left < other.right && other.left < one.right && one.top < other.bottom && other.top < one.bottom;

// Everything the story drew BELOW `root` — the root's own box deliberately excluded, so
// the question "may the crop step into this child" is not silently asking a child to
// contain its parent. Content its own ancestors clip away is left out too: it is not on
// screen, so a frame that omits it omits nothing a reader could see.
const drawnBelow = (root: Element): Box | null =>
    descendantBounds(
        Array.from(root.querySelectorAll("*"))
            .filter(drawn)
            .filter((el) => {
                const clip = clipOf(el);
                return clip === null || intersects(boxOf(el), clip);
            })
            .map(boxOf),
    );

// Whether the element draws anything of its own — a ground, an edge, a shadow. If it
// does, it IS the picture, and the shape inside it is only part of one.
const paints = (el: Element): boolean => {
    const style = getComputedStyle(el);
    if (style.backgroundImage !== "none") {
        return true;
    }
    if (style.backgroundColor !== "rgba(0, 0, 0, 0)" && style.backgroundColor !== "transparent") {
        return true;
    }
    if (style.boxShadow !== "none" || style.outlineStyle !== "none") {
        return true;
    }
    return (["Top", "Right", "Bottom", "Left"] as const).some(
        (side) =>
            style[`border${side}Style`] !== "none" &&
            Number.parseFloat(style[`border${side}Width`]) > 0,
    );
};

// Whether the element carries text of its own, alongside whatever element sits in it.
// A verdict card is a badge and a sentence; descending to the badge drops the sentence.
const hasOwnText = (el: Element): boolean =>
    Array.from(el.childNodes).some(
        (node) => node.nodeType === Node.TEXT_NODE && (node.textContent ?? "").trim() !== "",
    );

// The tightest box that is still a picture of the story.
//
// The container Storybook renders into is a plain block div, as wide as the viewport
// whatever sits in it, and the allowance is a fraction of what gets captured — which a
// lone icon button in a full-width box spends on the empty margin either side. So the
// crop follows a lone child down. What it must not do is follow it all the way: an
// `<svg>` reports its shapes' geometry rather than a layout box, so descending into one
// lands on a stroke outline, which is ~100% ink and asserts nothing about the control
// drawn around it. Every guard here marks a place where the thing being looked at ends.
const tightest = (el: Element, all: Box): Element => {
    if (el instanceof SVGElement || paints(el) || hasOwnText(el)) {
        return el;
    }
    const children = Array.from(el.children).filter(drawn);
    const only = children.length === 1 ? children[0] : undefined;
    if (!only || !mayDescend(boxOf(el), boxOf(only), all)) {
        return el;
    }
    return tightest(only, all);
};

// The outermost thing the story actually put on screen inside its container, when the
// container itself has no box. A `fixed` or absolute child does not contribute to its
// parent's, so an empty container is not the same question as an empty story — the
// descendants have to be asked separately, or content that is merely out of the flow
// reads as content that isn't there. Document order puts the outermost first, which is
// the whole of what was drawn rather than a part of it.
const drawnInside = (root: HTMLElement) => Array.from(root.querySelectorAll("*")).find(drawn);

// The same phone box the browser-mobile project uses, for a story the wide one hides.
const PHONE = { width: 390, height: 844 };

// What to compare, and at what size.
//
// The container is the subject wherever the story fills it. Two things stop it being:
//
// A `fixed` bar leaves the container zero-sized however much of it is on screen, so what
// gets compared is the bar rather than the container that nominally holds it.
//
// Content the viewport width hides is the other case, and it wants a different remedy.
// The bottom tab bar is `md:hidden`, so at the wide box it can never appear: its
// baseline was an empty frame, asserting nothing about a bar nobody could see. A story
// with nothing on screen at all is retried at a phone box and captured there.
//
// A portal is the last case, and the only one with nothing in the container to point at:
// its content hangs off the body, so the body is what there is to compare.
//
// Both sizes are fixed, so a baseline stays reproducible either way; the box to return
// to is read rather than restated, so it cannot drift from what the project renders at.
const captureTarget = async (root: HTMLElement) => {
    // A frame that cannot hold everything drawn is not a frame for this story: content
    // out of the flow — an open menu hanging below its trigger — would be cropped away,
    // and the baseline that lost it agrees with every future render that loses it too.
    // The whole viewport is the fallback, because it is the only box that holds anything.
    const of = (target: Element, restore: { width: number; height: number } | null) => {
        const all = drawnBelow(target);
        // Nothing below means nothing could have escaped, so the target frames itself.
        // Reaching for the body there would spend the whole allowance on empty page to
        // guard against content that does not exist.
        const frame =
            all === null
                ? target
                : holds(boxOf(target), all)
                  ? tightest(target, all)
                  : document.body;
        return { locator: page.elementLocator(frame), restore };
    };
    const inFlow = drawn(root) ? root : drawnInside(root);
    if (inFlow) {
        return of(inFlow, null);
    }
    const wide = { width: window.innerWidth, height: window.innerHeight };
    await page.viewport(PHONE.width, PHONE.height);
    await painted();
    const narrow = drawn(root) ? root : drawnInside(root);
    if (narrow) {
        return of(narrow, wide);
    }
    await page.viewport(wide.width, wide.height);
    await painted();
    return of(document.body, null);
};

// Every story doubles as a visual regression test in both themes: after it
// renders (and any play function has run), what it rendered is compared against a
// committed per-story baseline, then the `.dark` class — the same switch the app's
// theme store flips — goes on the root element and a second, `-dark`-named
// baseline is compared. The project runs only on chromium pinned by the flake, so
// local and CI rasterize with the same engine; the preview self-hosts the fonts
// (awaited here) and freezes animations, which is what makes a pixel comparison
// meaningful. Refresh baselines with `npm run test:storybook -- -u`.
afterEach(async (ctx) => {
    const key = `${ctx.task.file.name.split("/").pop()} > ${ctx.task.name}`;
    if (EMOJI_STORIES.has(key) || RASTER_UNSTABLE_STORIES.has(key)) {
        return;
    }
    // fonts.ready resolves once no loads are *pending* — a face nothing has
    // used yet hasn't begun loading, so the screenshot could catch the
    // fallback font mid-swap. Request the app face explicitly first.
    await document.fonts.load("400 16px 'Inter Variable'");
    await document.fonts.load("600 16px 'Inter Variable'");
    await document.fonts.ready;
    // fonts.ready resolves when the face has *loaded*, not when the text has
    // been laid out and painted with it. Wait for the swap to reach the screen:
    // the first capture then matches the baseline outright, which is what keeps
    // a story to a single screenshot round-trip. A capture that misses the swap
    // disagrees with the baseline and forces the comparator into repeated
    // frame-to-frame retries — on a busy machine those retries, not the
    // painting, are what exhaust the timeout.
    await painted();
    // Headroom for the retries a genuinely slow render still needs.
    const options = { timeout: 15_000 };
    const { locator, restore } = await captureTarget(storyRoot());
    try {
        await expect(locator).toMatchScreenshot(options);
        document.documentElement.classList.add("dark");
        // The theme flip restyles the whole tree; the same first-capture rule
        // applies, so let it reach the screen before comparing.
        await painted();
        await expect(locator).toMatchScreenshot(`${ctx.task.name}-dark`, options);
    } finally {
        document.documentElement.classList.remove("dark");
        if (restore) {
            await page.viewport(restore.width, restore.height);
        }
    }
});
