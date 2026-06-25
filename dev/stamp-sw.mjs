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
const PLACEHOLDER = "__BUILD_HASH__";

const names = readdirSync(ASSETS).sort().join("\n");
const hash = createHash("sha256").update(names).digest("hex").slice(0, 12);

const source = readFileSync(SW, "utf8");
if (!source.includes(PLACEHOLDER)) {
    throw new Error(`Service worker ${SW} has no ${PLACEHOLDER} to stamp.`);
}
writeFileSync(SW, source.replaceAll(PLACEHOLDER, hash));
console.log(`Stamped service worker cache: plinky-${hash}`);
