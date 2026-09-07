// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Stamps the built service worker's cache name with a hash of the build's hashed
// assets. Because asset filenames are content-addressed, the hash changes exactly
// when the build's output changes, so each deploy gets a fresh cache name. The SW
// activate handler then evicts the previous cache — including any HTML that still
// references chunks this deploy removed, which would otherwise white-screen an
// offline-after-deploy visitor.
//
// The same pass stamps the offline page's copy, in every language, from the message
// catalogue: the page is what the worker answers with when a route's code cannot be
// fetched, so it must render from itself alone, with nothing left to load.
//
// Plain JavaScript on Node built-ins only, because the deploy runs it with nothing
// installed.

import { createHash } from "node:crypto";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";

const OUT = "build/client";
const HASH_PLACEHOLDER = "__BUILD_HASH__";
const PRECACHE_PLACEHOLDER = "__PRECACHE__";
const COPY_PLACEHOLDER = "__OFFLINE_COPY__";

// The strings the offline page shows, by their message keys.
export const OFFLINE_MESSAGES = {
    title: "offline_title",
    body: "offline_body",
    retry: "offline_retry",
    home: "offline_home",
};

export function buildHash(out = OUT) {
    const names = readdirSync(`${out}/assets`).sort().join("\n");
    return createHash("sha256").update(names).digest("hex").slice(0, 12);
}

// The shell chunks a fresh, offline visitor needs to boot the app: the /assets URLs the
// prerendered root document and the SPA-fallback shell reference. Precaching these means a
// new build's cache holds what its HTML loads, so activate evicting the old cache can't
// leave an offline-after-update visitor on a white screen. Route-lazy chunks stay on demand.
export function shellAssets(out = OUT) {
    const docs = [`${out}/index.html`, `${out}/__spa-fallback.html`];
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

// The offline page's copy for every language: { en: { title, body, retry, home }, … }.
// Read straight from the catalogue files rather than the compiled messages, because the
// deploy stamps with nothing installed. A language missing one of the keys is an error
// here rather than a blank line on the page — messages:check holds the same rule, and
// this is the one consumer of the catalogue that gate does not cover.
export function offlineCopy(locales, messagesDir = "messages") {
    const copy = {};
    for (const locale of locales) {
        const catalogue = JSON.parse(readFileSync(`${messagesDir}/${locale}.json`, "utf8"));
        const strings = {};
        for (const [field, key] of Object.entries(OFFLINE_MESSAGES)) {
            const text = catalogue[key];
            if (typeof text !== "string" || text.trim() === "") {
                throw new Error(`messages/${locale}.json has no ${key} for the offline page`);
            }
            strings[field] = text;
        }
        copy[locale] = strings;
    }
    return copy;
}

function stampInto(path, replacements) {
    let source = readFileSync(path, "utf8");
    for (const [placeholder, value] of Object.entries(replacements)) {
        if (!source.includes(placeholder)) {
            throw new Error(`${path} has no ${placeholder} to stamp.`);
        }
        source = source.replaceAll(placeholder, value);
    }
    writeFileSync(path, source);
}

export function stampServiceWorker(out = OUT) {
    const hash = buildHash(out);
    const precache = shellAssets(out);
    // Joined by an escaped newline so the value stays a single valid JS string literal; the
    // SW splits it back on "\n" at runtime.
    stampInto(`${out}/sw.js`, {
        [HASH_PLACEHOLDER]: hash,
        [PRECACHE_PLACEHOLDER]: precache.join("\\n"),
    });
    return { hash, precache };
}

export function stampOfflinePage(locales, out = OUT, messagesDir = "messages") {
    const copy = offlineCopy(locales, messagesDir);
    // Serialised as a JS object literal inside a <script>; "<" is escaped so no string
    // in any language can close the script element early.
    const literal = JSON.stringify(copy).replaceAll("<", "\\u003c");
    stampInto(`${out}/offline.html`, { [COPY_PLACEHOLDER]: literal });
    return copy;
}

// Guarded so the module can be imported by its test without writing anything.
if (process.argv[1]?.endsWith("stamp-sw.mjs")) {
    const { locales } = JSON.parse(readFileSync("project.inlang/settings.json", "utf8"));
    const { hash, precache } = stampServiceWorker();
    const copy = stampOfflinePage(locales);
    console.log(
        `Stamped service worker cache: plinky-${hash} (${precache.length} shell assets); ` +
            `offline page in ${Object.keys(copy).length} languages`,
    );
}
