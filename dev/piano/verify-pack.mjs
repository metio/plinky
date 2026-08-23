// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Checks that a published pack is the pack that was built, in full.
//
// An upload of six hundred objects fails partially and quietly: a handful time out, the
// manifest lands anyway, and the app plays a synthesised note wherever a recording is
// missing — which sounds like nothing being wrong. So this asks the origin about every
// object the manifest names, compares sizes with what was built, and checks the headers a
// browser will actually need.
//
// Usage: node dev/piano/verify-pack.mjs [--base https://samples.plinky.fun/v1] [--pack piano-pack/v1]

import { existsSync, statSync } from "node:fs";
import { join } from "node:path";

const BASE = argValue("--base") ?? "https://samples.plinky.fun/v1";
const PACK = argValue("--pack") ?? "piano-pack/v1";
const CONCURRENCY = Number(argValue("--concurrency") ?? 16);
// The origin the app is served from, so the CORS answer is the one it will get.
const ORIGIN = argValue("--origin") ?? "https://plinky.fun";

function argValue(flag) {
    const index = process.argv.indexOf(flag);
    return index > 0 ? process.argv[index + 1] : undefined;
}

const problems = [];
const note = (message) => {
    problems.push(message);
    console.log(`  ✗ ${message}`);
};

const live = await fetch(`${BASE}/manifest.json`, { headers: { Origin: ORIGIN } });
if (!live.ok) {
    console.error(`${BASE}/manifest.json answered ${live.status}. Nothing else can be checked.`);
    process.exit(1);
}
const manifest = await live.json();
console.log(
    `${manifest.instrument} ${manifest.version} — ${manifest.notes.length} notes, ` +
        `${manifest.releases.length} releases`,
);

// The credit is a condition of the licence, so its absence is a fault rather than a
// cosmetic gap.
for (const field of ["instrument", "author", "license", "source"]) {
    if (!manifest[field]) {
        note(`manifest has no ${field}, which the licence requires be shown`);
    }
}

// The app's own reading of the mapping: every key at every dynamic must find a recording,
// or that note is silently played by the synth forever.
const KEYS = { low: 21, high: 108 };
let gaps = 0;
for (let pitch = KEYS.low; pitch <= KEYS.high; pitch++) {
    for (const velocity of [1, 32, 64, 96, 127]) {
        const covered = manifest.notes.some(
            (region) =>
                pitch >= region.lowKey &&
                pitch <= region.highKey &&
                velocity >= region.lowVelocity &&
                velocity <= region.highVelocity,
        );
        if (!covered) {
            gaps += 1;
        }
    }
}
if (gaps > 0) {
    note(`${gaps} key/velocity pairs no recording covers — middle C is 60`);
}

// What was built, if it is still here, so a truncated upload shows up as a size mismatch
// rather than as a file that merely exists.
const built = existsSync(join(PACK, "manifest.json"))
    ? new Map(
          [...manifest.notes, ...manifest.releases]
              .map((region) => region.file)
              .filter((file) => existsSync(join(PACK, file)))
              .map((file) => [file, statSync(join(PACK, file)).size]),
      )
    : new Map();
if (built.size === 0) {
    console.log("  (no local pack to compare sizes against; checking the origin only)");
}

const files = [...new Set([...manifest.notes, ...manifest.releases].map((r) => r.file))];
console.log(`checking ${files.length} objects at ${BASE}`);

let checked = 0;
const queue = [...files];
async function worker() {
    for (;;) {
        const file = queue.shift();
        if (!file) {
            return;
        }
        try {
            const response = await fetch(`${BASE}/${file}`, {
                method: "HEAD",
                headers: { Origin: ORIGIN },
            });
            if (!response.ok) {
                note(`${file}: ${response.status}`);
            } else {
                const length = Number(response.headers.get("content-length") ?? 0);
                const expected = built.get(file);
                if (expected !== undefined && length !== expected) {
                    note(`${file}: ${length} bytes published, ${expected} built`);
                }
                if (!response.headers.get("access-control-allow-origin")) {
                    note(`${file}: no CORS header, so the app cannot read it`);
                }
            }
        } catch (error) {
            note(`${file}: ${error instanceof Error ? error.message : String(error)}`);
        }
        checked += 1;
        if (checked % 100 === 0) {
            console.log(`  ${checked}/${files.length}`);
        }
    }
}
await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

// The headers a browser needs, read off one real object.
const sample = await fetch(`${BASE}/${files[0]}`, { headers: { Origin: ORIGIN } });
const type = sample.headers.get("content-type") ?? "";
if (!/audio|ogg|opus/.test(type)) {
    note(`served as ${type || "no content-type"} rather than audio/ogg`);
}
if (!/max-age=\d{6,}/.test(sample.headers.get("cache-control") ?? "")) {
    note(
        `cache-control is "${sample.headers.get("cache-control") ?? "unset"}" — these never change`,
    );
}

console.log(
    problems.length === 0
        ? `\nAll ${files.length} objects published, sized and readable. The pack is complete.`
        : `\n${problems.length} problems.`,
);
process.exit(problems.length === 0 ? 0 : 1);
