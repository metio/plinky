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
afterEach(async () => {
    await document.fonts.ready;
    await expect(page.elementLocator(document.body)).toMatchScreenshot();
});
