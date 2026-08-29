// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Which ci-* wrappers the workflow actually runs, read out of the workflow.
//
// One reader, used by the parity check and by the local runner, so the two can never
// disagree about what CI is. A hand-kept list of gates is the thing this exists to stop:
// picking gates by which ones look related to a change is how a push goes red on the one
// that was not picked, and picking them by memory is worse.

import { readFileSync } from "node:fs";

// Steps that set a job up rather than gate it.
export const SETUP_COMMANDS = new Set(["npm ci"]);

// Every ci-* wrapper named by a step, and every raw command that should have been one.
export function gatesInWorkflow(path = ".github/workflows/verify.yml") {
    const workflow = readFileSync(path, "utf8");
    const wrappers = [];
    const raw = [];
    let job = null;
    for (const line of workflow.split("\n")) {
        const header = line.match(/^ {2}([A-Za-z0-9_-]+):\s*$/);
        if (header) {
            job = header[1];
            continue;
        }
        // A comment may quote an invocation as prose without being a step.
        if (line.trim().startsWith("#")) {
            continue;
        }
        const invocation = line.match(/nix develop --command\s+(.+?)\s*$/);
        if (!invocation) {
            continue;
        }
        const command = invocation[1].trim();
        if (SETUP_COMMANDS.has(command)) {
            continue;
        }
        const wrapper = command.match(/^(ci-[a-z0-9-]+)\b/);
        if (wrapper) {
            if (!wrappers.includes(wrapper[1])) {
                wrappers.push(wrapper[1]);
            }
        } else {
            raw.push({ job, command });
        }
    }
    return { wrappers, raw };
}

// The gates that need a built site, a browser fleet, or an instrumented run of the whole
// tree. Named rather than guessed, and NAMED IN THE OUTPUT when skipped: a runner that
// quietly leaves five gates out reads as "everything passed" when it is not.
export const HEAVY = new Set([
    "ci-build",
    "ci-lighthouse",
    "ci-widths",
    "ci-a11y-light",
    "ci-a11y-dark",
    "ci-coverage",
    "ci-storybook",
    "ci-browser",
]);
