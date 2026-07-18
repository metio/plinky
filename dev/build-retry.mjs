// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// Runs `react-router build`, retrying ONLY the transient prerender flake. React Router
// prerenders every localized route by fetching it from an in-process Vite preview server;
// that server occasionally resets a connection under the fan-out, and the prerenderer's
// retryCount defaults to 0 (not user-configurable here), so a single reset fails the whole
// build with "Prerender: Request failed for /<locale>/:" and an empty message. Retrying the
// build clears it. A genuine failure (a real prerender error carries a status/message, or a
// compile/type error prints no such line) is NOT retried — it exits immediately.

import { spawn } from "node:child_process";

// A plain `npm run build` — no PLINKY_LOCALE, no PLINKY_ROOT_ONLY — is the
// all-locales dev build: every language in one tree, for local preview. It is not
// what ships (the deploy builds one locale per language via dev/build-locales.mjs)
// and not what the size gate measures. Say so, because reaching for it before
// `npm run size` measures ~3× the per-visitor weight and trips the budget — use
// `nix develop --command ci-build` for that path instead.
if (!process.env.PLINKY_LOCALE && !process.env.PLINKY_ROOT_ONLY) {
    console.log(
        "ℹ all-locales dev build (every language in one tree — local preview only).\n" +
            "  For the bundle-size / a11y gates build a single locale: " +
            "`nix develop --command ci-build`, then `npm run size`.",
    );
}

const MAX_ATTEMPTS = 5;
// The flake: "Request failed for /da/:" with an empty message, or a timeout — both are the
// preview-server connection giving out, never a real route error (those carry a status).
const FLAKE = /Prerender: Request (?:failed for \/[^\n:]*: *(?:\n|$)|timed out)/;

function runBuild() {
    return new Promise((resolve) => {
        // shell:true resolves `react-router` via the npm-augmented PATH (node_modules/.bin).
        const child = spawn("react-router", ["build"], { shell: true });
        let output = "";
        const tee = (stream, sink) =>
            stream.on("data", (chunk) => {
                sink.write(chunk);
                output += chunk.toString();
            });
        tee(child.stdout, process.stdout);
        tee(child.stderr, process.stderr);
        child.on("close", (code) => resolve({ code, output }));
    });
}

for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const { code, output } = await runBuild();
    if (code === 0) {
        process.exit(0);
    }
    const isFlake = FLAKE.test(output);
    if (!isFlake || attempt === MAX_ATTEMPTS) {
        console.error(
            isFlake
                ? `\nPrerender flake persisted after ${MAX_ATTEMPTS} attempts.`
                : "\nBuild failed (not the prerender flake) — not retrying.",
        );
        process.exit(code ?? 1);
    }
    console.error(`\n⟳ Prerender flake on attempt ${attempt}; retrying the build…`);
}
