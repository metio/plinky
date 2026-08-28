// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A fingerprint of the code that renders a clip, so --resume can tell a finished clip from
// a stale one.
//
// Resuming used to mean "a file is already there", which is not a claim about what
// produced it. A batch that runs for hours across an edit — or one resumed the next day
// against changed code — keeps every clip it already has, and the only visible difference
// is the video itself. That is how sixty-four clips came to be cut at a flat twenty
// seconds long after the cut had been rewritten, and how their modification times came to
// say otherwise.
//
// The fingerprint is taken over the module graph the render actually pulls in, walked from
// renderPromo.ts through its relative imports. Nothing to keep in step by hand: a file that
// stops being imported leaves the graph, and one that starts being imported joins it.

import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

const ENTRY = "dev/promo/renderPromo.ts";
// Bare specifiers are dependencies, pinned by package-lock and covered by it rather than
// by this. Only the repo's own modules are walked.
const RELATIVE = /(?:^|[\s;])(?:import|export)[\s\S]*?from\s*["'](\.[^"']+)["']/g;
const DYNAMIC = /\bimport\(\s*["'](\.[^"']+)["']\s*\)/g;

function resolveModule(specifier, fromFile) {
    const base = resolve(dirname(fromFile), specifier);
    for (const candidate of [base, `${base}.ts`, `${base}.tsx`, join(base, "index.ts")]) {
        if (existsSync(candidate) && !candidate.endsWith("/")) {
            try {
                readFileSync(candidate);
                return candidate;
            } catch {
                // a directory that exists but cannot be read as a file
            }
        }
    }
    return null;
}

// Every repo module the render reaches, entry included.
export function renderGraph(entry = ENTRY) {
    const seen = new Set();
    const queue = [resolve(entry)];
    while (queue.length > 0) {
        const file = queue.pop();
        if (seen.has(file)) {
            continue;
        }
        seen.add(file);
        const source = readFileSync(file, "utf8");
        for (const pattern of [RELATIVE, DYNAMIC]) {
            pattern.lastIndex = 0;
            let match = pattern.exec(source);
            while (match !== null) {
                const target = resolveModule(match[1], file);
                if (target !== null) {
                    queue.push(target);
                }
                match = pattern.exec(source);
            }
        }
    }
    return [...seen].sort();
}

// What every clip rendered by this code should be stamped with.
export function renderStamp() {
    const hash = createHash("sha256");
    for (const file of renderGraph()) {
        hash.update(relative(process.cwd(), file));
        hash.update("\\0");
        hash.update(readFileSync(file));
        hash.update("\\0");
    }
    return hash.digest("hex").slice(0, 16);
}
