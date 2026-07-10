// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { setProjectAnnotations } from "@storybook/react-vite";
import { page } from "vitest/browser";
import { afterEach, beforeAll, expect } from "vitest";
import projectAnnotations from "./preview";

// Apply the preview's decorators and parameters when running stories as tests.
const project = setProjectAnnotations([projectAnnotations]);
beforeAll(project.beforeAll);

// Every story doubles as a visual regression test: after it renders (and any
// play function has run), the rendered document is compared against a committed
// per-story baseline. The project runs only on chromium pinned by the flake, so
// local and CI rasterize with the same engine; the preview self-hosts the font
// (awaited here) and freezes animations, which is what makes a pixel
// comparison meaningful. Refresh baselines with `npm run test:storybook -- -u`.
// Stories whose rendering genuinely drifts between machines — anti-aliasing-dense
// SVG charts where sub-pixel rasterization lands differently on CI's CPU than
// locally. Each entry is a reviewed, named exception ("file > story") granted a
// 0.5% mismatch allowance instead of the strict 0.1% default; adding to this list
// is a deliberate act, not a knob to turn when a baseline goes red.
const AA_DRIFTERS = new Set(["tempoGraph.stories.tsx > Two Hands"]);

afterEach(async (ctx) => {
    // fonts.ready resolves once no loads are *pending* — a face nothing has
    // used yet hasn't begun loading, so the screenshot could catch the
    // fallback font mid-swap. Request the app face explicitly first.
    await document.fonts.load("400 16px 'Inter Variable'");
    await document.fonts.load("600 16px 'Inter Variable'");
    await document.fonts.ready;
    const key = `${ctx.task.file.name.split("/").pop()} > ${ctx.task.name}`;
    await expect(page.elementLocator(document.body)).toMatchScreenshot(
        AA_DRIFTERS.has(key)
            ? { comparatorName: "pixelmatch", comparatorOptions: { allowedMismatchedPixelRatio: 0.005 } }
            : {},
    );
});
