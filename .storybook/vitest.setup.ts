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

// Every story doubles as a visual regression test: after it renders (and any
// play function has run), the rendered document is compared against a committed
// per-story baseline. The project runs only on chromium pinned by the flake, so
// local and CI rasterize with the same engine; the preview self-hosts the fonts
// (awaited here) and freezes animations, which is what makes a pixel
// comparison meaningful. Refresh baselines with `npm run test:storybook -- -u`.
afterEach(async (ctx) => {
    const key = `${ctx.task.file.name.split("/").pop()} > ${ctx.task.name}`;
    if (EMOJI_STORIES.has(key)) {
        return;
    }
    // fonts.ready resolves once no loads are *pending* — a face nothing has
    // used yet hasn't begun loading, so the screenshot could catch the
    // fallback font mid-swap. Request the app face explicitly first.
    await document.fonts.load("400 16px 'Inter Variable'");
    await document.fonts.load("600 16px 'Inter Variable'");
    await document.fonts.ready;
    await expect(page.elementLocator(document.body)).toMatchScreenshot({
        // The capture is retried until two consecutive frames match; a loaded
        // CI runner can still be painting well past the 5s default.
        timeout: 15_000,
    });
});
