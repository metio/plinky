// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Counts what the deploy is about to upload against the host's cap.
//
// Cloudflare Pages holds at most twenty thousand files in one deployment, and refuses the
// whole upload past it. The site's pages in twenty-six languages are about eleven
// thousand; each piece's social card is one more (dev/gen-og.mts); a catalogue import
// adds to both. Nothing else counts, so the count is checked here, before the upload,
// with a margin that says "look at this" a few imports before it says "no".

import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

export const FILE_LIMIT = 20_000;
// Room for a catalogue import's worth of pieces before the cap is the wall.
export const FILE_MARGIN = 1_500;

export function countFiles(dir) {
    let count = 0;
    for (const name of readdirSync(dir)) {
        const full = join(dir, name);
        count += statSync(full).isDirectory() ? countFiles(full) : 1;
    }
    return count;
}

// Fails past the cap; warns inside the margin; returns the count either way.
export function checkDeployFiles(dir = "build/client", limit = FILE_LIMIT, margin = FILE_MARGIN) {
    const count = countFiles(dir);
    if (count > limit) {
        throw new Error(
            `${dir} holds ${count} files and Cloudflare Pages uploads at most ${limit} — ` +
                "fewer cards (dev/gen-og.mts) or fewer prerendered pages before this deploys",
        );
    }
    if (count > limit - margin) {
        console.warn(
            `${dir}: ${count} files, within ${limit - count} of the ${limit} Cloudflare Pages allows`,
        );
    }
    return count;
}

if (process.argv[1]?.endsWith("check-deploy-files.mjs")) {
    const count = checkDeployFiles();
    console.log(`build/client: ${count} files (Cloudflare Pages allows ${FILE_LIMIT}).`);
}
