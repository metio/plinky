// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
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
            // istanbul instruments at transform time, so coverage is collected
            // uniformly in both the node and browser projects and merges into one
            // report — v8 does not instrument browser-run code here.
            provider: "istanbul",
            include: ["app/**/*.{ts,tsx}"],
            // The Paraglide output is generated, and its .d.ts files are not valid
            // runtime modules for the instrumenter to parse.
            exclude: ["app/paraglide/**", "**/*.d.ts"],
            reporter: ["text", "html", "lcov"],
            // Ratchet: CI fails if any metric drops below these. Raise them as
            // coverage grows; never lower them merely to make a red build pass.
            // Re-baselined when the ABC trainer engine (a large, heavily-unit-tested
            // layer) was removed in the move to MusicXML, leaving a higher share of
            // UI-route code; the catalogue and engine themselves stay well covered.
            thresholds: {
                statements: 74,
                branches: 66,
                functions: 71,
                lines: 74,
            },
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
            // Every story runs as a browser test, so stories double as tests and
            // count toward coverage.
            {
                plugins: [storybookTest({ configDir: ".storybook" })],
                test: {
                    name: "storybook",
                    setupFiles: [".storybook/vitest.setup.ts"],
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
