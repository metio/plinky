// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

// Deliberately separate from vite.config.ts: the React Router plugin there is
// incompatible with the test runner. Two projects: most tests run in node (with
// component tests opting into jsdom via a `// @vitest-environment jsdom`
// docblock); a small browser project covers code that depends on
// OpenSheetMusicDisplay, which only renders and populates note pitches under a
// real browser.
export default defineConfig({
    // Dedupe React so browser-rendered component tests share one instance, and
    // pre-bundle the JSX runtime so a dynamic import does not reload a test
    // mid-run.
    resolve: { dedupe: ["react", "react-dom"] },
    optimizeDeps: {
        // Pre-bundle OpenSheetMusicDisplay too: the components import it dynamically, and
        // if Vite optimizes it on-the-fly the first browser test to load it pays a slow,
        // variable cost — long enough that a waitFor(svg) can time out. Pre-bundling makes
        // every OSMD load fast and consistent, which is the real cure for the render flake.
        include: [
            "react",
            "react-dom",
            "react-dom/client",
            "react/jsx-runtime",
            "opensheetmusicdisplay",
        ],
    },
    test: {
        // OSMD renders under a real browser on its own schedule and can be slow on a
        // loaded machine. Rather than fail a test that just hadn't rendered yet, give the
        // polls (waitFor/findBy) and the hard per-test limit generous headroom so they
        // wait the render out — and keep a couple of retries as a last-resort backstop.
        testTimeout: 60_000,
        retry: 2,
        coverage: {
            // istanbul instruments at transform time, so coverage is collected
            // uniformly in both the node and browser projects and merges into one
            // report — v8 does not instrument browser-run code here.
            provider: "istanbul",
            include: ["app/**/*.{ts,tsx}", "core/**/*.ts"],
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
                    // core/ is the pure domain layer and dev/ the catalogue build tooling
                    // (import filters, grading); both are unit-tested here alongside app/.
                    include: [
                        "app/**/*.test.{ts,tsx}",
                        "core/**/*.test.{ts,tsx}",
                        "dev/**/*.test.mts",
                    ],
                    exclude: ["app/**/*.browser.test.*", "core/**/*.browser.test.*"],
                    setupFiles: ["./app/test-setup.ts", "./app/test-setup.node.ts"],
                },
            },
            {
                test: {
                    name: "browser",
                    include: ["app/**/*.browser.test.{ts,tsx}", "core/**/*.browser.test.{ts,tsx}"],
                    setupFiles: ["./app/test-setup.ts"],
                    browser: {
                        enabled: true,
                        // MIDI arrives pre-granted, so the real Web MIDI adapter's
                        // permission and silent-resume paths run for real. Chromium
                        // gates even sysex-free access behind the sysex grant.
                        provider: playwright({
                            contextOptions: { permissions: ["midi", "midi-sysex"] },
                        }),
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
