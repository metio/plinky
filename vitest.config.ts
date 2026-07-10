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
                    exclude: [
                        "app/**/*.browser.test.*",
                        "core/**/*.browser.test.*",
                        "app/**/*.mobile.test.*",
                        "core/**/*.mobile.test.*",
                    ],
                    setupFiles: ["./app/test-setup.ts", "./app/test-setup.node.ts"],
                },
            },
            {
                // The bulk of the browser suite injects fakeMidi, so it exercises
                // OSMD/SVG rendering, layout, input and a11y rather than Web MIDI —
                // engine-agnostic work worth running on a second engine. Firefox's
                // Gecko joins Chromium here. The real Web MIDI path lives in the
                // browser-midi project below; Playwright rejects the `midi`
                // permission on Firefox, so this project must not request it.
                test: {
                    name: "browser",
                    include: ["app/**/*.browser.test.{ts,tsx}", "core/**/*.browser.test.{ts,tsx}"],
                    exclude: ["app/contexts/midi.browser.test.tsx"],
                    setupFiles: ["./app/test-setup.ts"],
                    browser: {
                        enabled: true,
                        provider: playwright(),
                        headless: true,
                        instances: [{ browser: "chromium" }, { browser: "firefox" }],
                    },
                },
            },
            {
                // The real Web MIDI adapter can only be automated in Chromium:
                // Playwright grants its `midi`/`midi-sysex` permission there, so the
                // adapter's genuine permission and silent-resume paths run for real
                // (Chromium gates even sysex-free access behind the sysex grant).
                // Firefox gates Web MIDI behind a site-permission add-on that can't
                // be provisioned here, and WebKit has no Web MIDI at all — neither
                // can run these, so this project stays Chromium-only.
                test: {
                    name: "browser-midi",
                    include: ["app/contexts/midi.browser.test.tsx"],
                    setupFiles: ["./app/test-setup.ts"],
                    browser: {
                        enabled: true,
                        provider: playwright({
                            contextOptions: { permissions: ["midi", "midi-sysex"] },
                        }),
                        headless: true,
                        instances: [{ browser: "chromium" }],
                    },
                },
            },
            {
                // The mobile viewport project: the play/notation flows rendered at a
                // phone size with touch input — the profile the mobile-first surface
                // (auto-scroll, focus strip, rotate hint, on-screen keyboard) targets and
                // that the desktop `browser` project never exercises, so regressions that
                // only show at phone width and coarse pointer slip past every other gate.
                // Its name starts with "browser" so the `browser*` project glob (and the
                // ci-test-browser gate) picks it up with no extra wiring. Chromium-only:
                // Playwright's isMobile/touch emulation is a Chromium feature that Firefox
                // rejects. Files carry the `.mobile.test.tsx` suffix.
                test: {
                    name: "browser-mobile",
                    include: ["app/**/*.mobile.test.{ts,tsx}", "core/**/*.mobile.test.{ts,tsx}"],
                    setupFiles: ["./app/test-setup.ts"],
                    browser: {
                        enabled: true,
                        provider: playwright({
                            contextOptions: { hasTouch: true, isMobile: true },
                        }),
                        headless: true,
                        // A representative small phone in portrait: narrow enough to trip
                        // the compact/portrait layout branches, tall enough to be realistic.
                        viewport: { width: 390, height: 844 },
                        instances: [{ browser: "chromium" }],
                    },
                },
            },
            // Every story runs as a browser test, so stories double as tests and
            // count toward coverage — and each one is also a visual regression
            // test: the setup file screenshots the rendered story and compares it
            // against a committed baseline (see .storybook/vitest.setup.ts).
            {
                plugins: [storybookTest({ configDir: ".storybook" })],
                test: {
                    name: "storybook",
                    setupFiles: [".storybook/vitest.setup.ts"],
                    browser: {
                        enabled: true,
                        provider: playwright(),
                        headless: true,
                        // One canonical render box: the screenshots are pixel
                        // baselines, so the viewport must never float with the
                        // environment. Chromium-only for the same reason — one
                        // engine, pinned by the flake on every machine.
                        viewport: { width: 800, height: 600 },
                        instances: [{ browser: "chromium" }],
                        expect: {
                            toMatchScreenshot: {
                                comparatorName: "pixelmatch",
                                // The strict default: cross-machine rendering is
                                // near-perfect (most stories match CI byte-for-byte),
                                // so 0.1% absorbs sub-pixel anti-aliasing jitter and
                                // nothing more. AA-dense stories that genuinely drift
                                // between machines get a named, per-story allowance in
                                // .storybook/vitest.setup.ts — never widen this one.
                                comparatorOptions: { allowedMismatchedPixelRatio: 0.001 },
                                // Baselines are committed, so they live outside the
                                // gitignored __screenshots__ failure-capture dir.
                                resolveScreenshotPath: ({
                                    root,
                                    testFileDirectory,
                                    testFileName,
                                    arg,
                                    browserName,
                                    ext,
                                }) =>
                                    `${root}/${testFileDirectory}/__story-shots__/${testFileName}/${arg}-${browserName}${ext}`,
                            },
                        },
                    },
                },
            },
        ],
    },
});
