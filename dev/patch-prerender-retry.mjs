// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// Removes the prerender flake at its source. React Router prerenders every localized
// route by fetching it from an in-process Vite preview server; that server intermittently
// resets a lone connection (an empty-message "Prerender: Request failed for /<locale>/:")
// or lets one request run long ("Request timed out"). The prerenderer's own retry is
// governed by `retryCount`, which defaults to 0 and is NOT reachable through
// react-router.config.ts — its options closure passes only buildDirectory + concurrency
// (see @react-router/dev dist/vite.js) — so a single reset fails the whole build.
//
// This runs as `postinstall`, so every `npm ci` (local and CI) re-applies it against the
// pinned @react-router/dev in node_modules: it raises the built-in per-request retry, so a
// transient reset retries just that request in-place instead of aborting a multi-minute
// build. dev/build-retry.mjs stays as a whole-build backstop for the rare case this can't
// catch (and it would fire if a version bump ever moved the code this edits — see the loud
// warning below).

import { existsSync, readFileSync, writeFileSync } from "node:fs";

const TARGET = "node_modules/@react-router/dev/dist/vite.js";

// The prerenderer's default options, destructured in one place. Retry 0→3 (a transient
// socket reset clears on the next attempt), delay 500→1000ms (give the preview server a
// beat), and timeout 10s→20s (cover the slow-response variant of the same flake).
const FROM = "retryCount = 0, retryDelay = 500, maxRedirects = 0, timeout = 1e4";
const TO = "retryCount = 3, retryDelay = 1000, maxRedirects = 0, timeout = 2e4";

if (!existsSync(TARGET)) {
    // A partial or pruned install — nothing to patch. Don't break the install.
    console.warn(`patch-prerender-retry: ${TARGET} not found; skipping.`);
    process.exit(0);
}

const src = readFileSync(TARGET, "utf8");

if (src.includes(TO)) {
    console.log("patch-prerender-retry: already applied.");
    process.exit(0);
}

if (!src.includes(FROM)) {
    // A @react-router/dev bump moved or reshaped this code. Exit 0 so installs still work
    // (build-retry.mjs still guards the flake), but shout so the patch gets re-pinned.
    console.warn(
        "patch-prerender-retry: prerender options not found — @react-router/dev likely " +
            "changed. The per-request retry is NOT applied; re-point dev/patch-prerender-retry.mjs " +
            "at the new code. build-retry.mjs remains the whole-build backstop meanwhile.",
    );
    process.exit(0);
}

writeFileSync(TARGET, src.replace(FROM, TO));
console.log("patch-prerender-retry: raised prerender per-request retry (retryCount 0→3).");
