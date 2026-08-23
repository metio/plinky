// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Uploads a built sample pack to its R2 bucket.
//
// The dashboard refuses more than a hundred files at a time and a pack is six hundred, so
// this drives wrangler once per object, several at a time. It is resumable: every upload
// that lands is written to a log beside the pack, and a re-run skips what is already
// there — a connection that drops half way through costs the half that was left.
//
// Credentials come from the environment, never from an argument: a token on a command line
// ends up in shell history and in every log that records the command.
//
//   CLOUDFLARE_ACCOUNT_ID   the account the bucket belongs to
//   CLOUDFLARE_API_TOKEN    an R2 token with object read+write on this bucket alone
//
// Usage:
//   node dev/piano/upload-pack.mjs --bucket plinky-samples [--pack piano-pack] [--prefix v1]
//
// A published prefix is immutable: the app caches every recording by URL, so a re-encode
// belongs under a new one (v2/) rather than over an old one. This refuses to overwrite for
// that reason — pass --replace only when you mean to break every cache that has it.

import { spawn } from "node:child_process";
import { appendFileSync, existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const BUCKET = argValue("--bucket");
const PACK = argValue("--pack") ?? "piano-pack";
const PREFIX = argValue("--prefix") ?? "v1";
const CONCURRENCY = Number(argValue("--concurrency") ?? 8);
const REPLACE = process.argv.includes("--replace");

function argValue(flag) {
    const index = process.argv.indexOf(flag);
    return index > 0 ? process.argv[index + 1] : undefined;
}

// Opus in an Ogg container is what ffmpeg's libopus writes. Browsers decode by content,
// not by this, but an object served as the wrong type is a thing somebody has to debug
// later.
function contentType(name) {
    return name.endsWith(".json") ? "application/json" : "audio/ogg";
}

function run(args) {
    return new Promise((resolve) => {
        const child = spawn("npx", ["--yes", "wrangler@latest", ...args], {
            stdio: ["ignore", "ignore", "pipe"],
            env: process.env,
        });
        let error = "";
        child.stderr.on("data", (chunk) => {
            error += String(chunk);
        });
        child.on("close", (code) => resolve({ ok: code === 0, error }));
    });
}

if (!BUCKET) {
    console.error("Pass --bucket <name>");
    process.exit(1);
}
for (const name of ["CLOUDFLARE_ACCOUNT_ID", "CLOUDFLARE_API_TOKEN"]) {
    if (!process.env[name]) {
        console.error(
            `${name} is not set. Both are needed, and neither belongs on a command line.`,
        );
        process.exit(1);
    }
}

const dir = join(PACK, PREFIX);
if (!existsSync(join(dir, "manifest.json"))) {
    console.error(`No manifest at ${dir}/manifest.json — run npm run piano:build first.`);
    process.exit(1);
}

const log = join(PACK, `.uploaded-${PREFIX}`);
const done = new Set(existsSync(log) ? readFileSync(log, "utf8").split("\n").filter(Boolean) : []);
// The manifest goes last: while it is absent the app has no pack at all, which is a
// better half-uploaded state than a manifest naming recordings that are not there yet.
const files = readdirSync(dir)
    .filter((name) => name !== "manifest.json")
    .concat("manifest.json");
const todo = REPLACE ? files : files.filter((name) => !done.has(name));

const bytes = todo.reduce((sum, name) => sum + statSync(join(dir, name)).size, 0);
console.log(
    `${todo.length} of ${files.length} objects to upload (${(bytes / 1_000_000).toFixed(1)} MB) ` +
        `→ ${BUCKET}/${PREFIX}/`,
);

let uploaded = 0;
let failed = 0;
const queue = [...todo];
async function worker() {
    for (;;) {
        const name = queue.shift();
        if (!name) {
            return;
        }
        const { ok, error } = await run([
            "r2",
            "object",
            "put",
            `${BUCKET}/${PREFIX}/${name}`,
            "--file",
            join(dir, name),
            // Without this wrangler writes to a local simulator and reports success.
            "--remote",
            "--content-type",
            contentType(name),
            // The bytes under a version prefix never change, so nothing has to revalidate.
            "--cache-control",
            "public, max-age=31536000, immutable",
        ]);
        if (ok) {
            appendFileSync(log, `${name}\n`);
            uploaded += 1;
        } else {
            failed += 1;
            console.error(`  ${name}: ${error.trim().split("\n").at(-1)}`);
        }
        if ((uploaded + failed) % 25 === 0) {
            console.log(`  ${uploaded + failed}/${todo.length}`);
        }
    }
}

await Promise.all(Array.from({ length: Math.max(1, CONCURRENCY) }, () => worker()));

console.log(`${uploaded} uploaded, ${failed} failed.`);
if (failed > 0) {
    console.log("Re-run to retry only what is missing; what landed is remembered.");
    process.exit(1);
}
console.log(`Check it: https://samples.plinky.fun/${PREFIX}/manifest.json`);
