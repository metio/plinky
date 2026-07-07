// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// Stamps the built service worker's cache name with a hash of the build's hashed
// assets. Because asset filenames are content-addressed, the hash changes exactly
// when the build's output changes, so each deploy gets a fresh cache name. The SW
// activate handler then evicts the previous cache — including any HTML that still
// references chunks this deploy removed, which would otherwise white-screen an
// offline-after-deploy visitor.

import { createHash } from "node:crypto";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";

const SW = "build/client/sw.js";
const ASSETS = "build/client/assets";
const HASH_PLACEHOLDER = "__BUILD_HASH__";
const PRECACHE_PLACEHOLDER = "__PRECACHE__";

const names = readdirSync(ASSETS).sort().join("\n");
const hash = createHash("sha256").update(names).digest("hex").slice(0, 12);

// The shell chunks a fresh, offline visitor needs to boot the app: the /assets URLs the
// prerendered root document and the SPA-fallback shell reference. Precaching these means a
// new build's cache holds what its HTML loads, so activate evicting the old cache can't
// leave an offline-after-update visitor on a white screen. Route-lazy chunks stay on demand.
function shellAssets() {
    const docs = ["build/client/index.html", "build/client/__spa-fallback.html"];
    const urls = new Set();
    for (const doc of docs) {
        let html;
        try {
            html = readFileSync(doc, "utf8");
        } catch {
            continue; // a per-locale build may not emit "/" or the fallback
        }
        for (const match of html.matchAll(/\/assets\/[A-Za-z0-9._-]+\.(?:js|css|woff2)/g)) {
            urls.add(match[0]);
        }
    }
    return [...urls].sort();
}

const source = readFileSync(SW, "utf8");
if (!source.includes(HASH_PLACEHOLDER)) {
    throw new Error(`Service worker ${SW} has no ${HASH_PLACEHOLDER} to stamp.`);
}
if (!source.includes(PRECACHE_PLACEHOLDER)) {
    throw new Error(`Service worker ${SW} has no ${PRECACHE_PLACEHOLDER} to stamp.`);
}
const precache = shellAssets();
// Joined by an escaped newline so the value stays a single valid JS string literal; the SW
// splits it back on "\n" at runtime.
const stamped = source
    .replaceAll(HASH_PLACEHOLDER, hash)
    .replaceAll(PRECACHE_PLACEHOLDER, precache.join("\\n"));
writeFileSync(SW, stamped);
console.log(`Stamped service worker cache: plinky-${hash} (${precache.length} shell assets)`);
