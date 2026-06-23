// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

// Deliberately separate from vite.config.ts: the React Router plugin there is
// incompatible with the test runner. Two projects: most tests run in node (with
// component tests opting into jsdom via a `// @vitest-environment jsdom`
// docblock); a small browser project covers code that depends on abcjs, which
// only populates note pitches under a real browser.
export default defineConfig({
    // Dedupe React so browser-rendered component tests share one instance, and
    // pre-bundle abcjs / the JSX runtime so a dynamic import does not reload a
    // test mid-run.
    resolve: { dedupe: ["react", "react-dom"] },
    optimizeDeps: {
        include: ["react", "react-dom", "react-dom/client", "react/jsx-runtime", "abcjs"],
    },
    test: {
        coverage: {
            provider: "v8",
            include: ["app/**/*.{ts,tsx}"],
            reporter: ["text", "html", "lcov"],
        },
        projects: [
            {
                test: {
                    name: "node",
                    environment: "node",
                    include: ["app/**/*.test.{ts,tsx}"],
                    exclude: ["app/**/*.browser.test.*"],
                },
            },
            {
                test: {
                    name: "browser",
                    include: ["app/**/*.browser.test.{ts,tsx}"],
                    browser: {
                        enabled: true,
                        provider: playwright(),
                        headless: true,
                        instances: [{ browser: "chromium" }],
                    },
                },
            },
        ],
    },
});
