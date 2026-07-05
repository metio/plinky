// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// Assembles build/client from the per-locale build artifacts a parallel CI
// matrix produced (see .github/workflows/website.yml). Same merge as the local
// dev/build-locales.mjs, but the inputs are downloaded artifacts instead of
// sequential builds.
//
// Expected layout of the artifacts directory (from actions/download-artifact):
//   <artifacts>/site-root/     — the all-locales base: "/", the SPA fallback, the
//                                public assets (songs, exercises, favicon…), and
//                                the root-redirect chunks.
//   <artifacts>/site-<locale>/ — that locale's <locale>/ pages + its assets/
//                                (tree-shaken to its own language).
//
// Content-hashed filenames make the assets merge safe: locale-independent chunks
// are byte-identical across builds and collapse to one copy; message-bearing
// chunks differ per locale and coexist, each referenced only by its locale's HTML.

import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";

const ARTIFACTS = process.argv[2] ?? "artifacts";
const CLIENT = "build/client";

const root = `${ARTIFACTS}/site-root`;
if (!existsSync(root)) {
    throw new Error(`merge-locale-artifacts: missing ${root} (the root build artifact).`);
}

rmSync(CLIENT, { recursive: true, force: true });
mkdirSync(CLIENT, { recursive: true });
cpSync(root, CLIENT, { recursive: true });

let merged = 0;
for (const entry of readdirSync(ARTIFACTS)) {
    if (!entry.startsWith("site-") || entry === "site-root") {
        continue;
    }
    const locale = entry.slice("site-".length);
    const dir = `${ARTIFACTS}/${entry}`;
    if (!existsSync(`${dir}/${locale}`)) {
        throw new Error(`merge-locale-artifacts: artifact ${entry} is missing its ${locale}/ pages.`);
    }
    cpSync(`${dir}/${locale}`, `${CLIENT}/${locale}`, { recursive: true });
    cpSync(`${dir}/assets`, `${CLIENT}/assets`, { recursive: true });
    merged += 1;
}

console.log(`merge-locale-artifacts: assembled ${CLIENT} from site-root + ${merged} locale(s).`);
