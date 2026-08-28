// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The dev server a render drives, and the guarantee that it is the one this run started.
//
// The render is a headless browser importing the app's modules over HTTP, so the server is
// where the code it runs actually comes from. Point the browser at a server somebody else
// started and the clips come out of somebody else's code — which is exactly what happened:
// a previous run was still alive, held the port, and this one's server quietly bound the
// next port up while the driver went on fetching from the old one. Every clip came out of
// a module graph two revisions stale, and each was stamped as current, because the stamp
// reads the files on disk in *this* process and never sees which server answered.
//
// So a busy port is refused rather than worked around. It also enforces the rule that two
// renders must not overlap at all: they regenerate the same app/paraglide/ under each
// other, and they compete for a machine that is already capped.

import { spawn } from "node:child_process";

// Whether anything at all is listening. A 404 still means somebody has the port.
async function answers(url) {
    try {
        await fetch(url, { signal: AbortSignal.timeout(2_000) });
        return true;
    } catch {
        return false;
    }
}

// Whether the app is actually being served, which is what a render needs.
async function serves(url) {
    try {
        return (await fetch(url, { signal: AbortSignal.timeout(5_000) })).ok;
    } catch {
        return false;
    }
}

// Starts the dev server on exactly this port, or throws.
export async function startDevServer(port) {
    if (await answers(`http://localhost:${port}/`)) {
        throw new Error(
            `something is already serving port ${port}. Another render is probably still ` +
                `running — renders must not overlap, and a driver that finds someone ` +
                `else's server renders someone else's code. Stop it and try again.`,
        );
    }
    const child = spawn("npx", ["react-router", "dev", "--port", String(port)], {
        stdio: ["ignore", "pipe", "inherit"],
        env: { ...process.env, PLINKY_NO_WATCH: "1" },
    });
    // Vite answers a taken port by taking the next one and mentioning it in passing. Left
    // unread, that one line is the whole bug, so it ends the run here.
    let moved = false;
    child.stdout.on("data", (chunk) => {
        const text = String(chunk);
        process.stdout.write(text);
        if (text.includes("is in use")) {
            moved = true;
        }
    });

    for (let i = 0; i < 120; i++) {
        if (moved) {
            child.kill();
            throw new Error(
                `the dev server could not take port ${port} and moved to another. ` +
                    `Refusing to render against a server this run did not start.`,
            );
        }
        if (child.exitCode !== null) {
            throw new Error(`the dev server exited with ${child.exitCode} before serving`);
        }
        if (await serves(`http://localhost:${port}/en/`)) {
            return child;
        }
        await new Promise((resolve) => setTimeout(resolve, 1_000));
    }
    child.kill();
    throw new Error(`dev server never came up on port ${port}`);
}
