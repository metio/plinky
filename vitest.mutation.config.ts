// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { defineConfig } from "vitest/config";

// Stryker mutation testing runs against the pure core/ layer only, and the vitest
// runner has no project filter — so this single-project config replaces the three
// projects in vitest.config.ts. The browser and storybook projects each need a real
// Chromium, which would be run once per surviving mutant: far too slow and flaky for
// a mutation sweep. core/ is pure and node-testable, so a plain node environment
// exercises every mutant deterministically and fast.
export default defineConfig({
    resolve: { dedupe: ["react", "react-dom"] },
    test: {
        name: "mutation",
        environment: "node",
        include: ["core/**/*.test.{ts,tsx}"],
        exclude: ["core/**/*.browser.test.*"],
        setupFiles: ["./app/test-setup.ts", "./app/test-setup.node.ts"],
    },
});
