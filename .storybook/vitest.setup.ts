// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { setProjectAnnotations } from "@storybook/react-vite";
import { page } from "vitest/browser";
import { afterEach, beforeAll, expect } from "vitest";
import projectAnnotations from "./preview";

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
    "discoveryChecklist.stories.tsx > Fresh",
    "discoveryChecklist.stories.tsx > Partly Done",
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

// Every story doubles as a visual regression test in both themes: after it
// renders (and any play function has run), the rendered document is compared
// against a committed per-story baseline, then the `.dark` class — the same
// switch the app's theme store flips — goes on the root element and a second,
// `-dark`-named baseline is compared. The project runs only on chromium pinned
// by the flake, so local and CI rasterize with the same engine; the preview
// self-hosts the fonts (awaited here) and freezes animations, which is what
// makes a pixel comparison meaningful. Refresh baselines with
// `npm run test:storybook -- -u`.
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
    const body = page.elementLocator(document.body);
    try {
        await expect(body).toMatchScreenshot(options);
        document.documentElement.classList.add("dark");
        // The theme flip restyles the whole tree; the same first-capture rule
        // applies, so let it reach the screen before comparing.
        await painted();
        await expect(body).toMatchScreenshot(`${ctx.task.name}-dark`, options);
    } finally {
        document.documentElement.classList.remove("dark");
    }
});
