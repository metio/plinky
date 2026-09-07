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
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";

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

// Every URL a language's pages need to work without a connection, for the keep-offline
// setting: the shell, every route's chunks from the build's own manifest, the catalogue
// index, the exercise manifest and that language's help pictures. Pieces are not on it:
// they are kept as they are opened, and forty megabytes of scores is not what a phone
// wants. Read off the language's home document, which names the manifest the routes
// come from, so a merged deploy holding every language's chunks still lists only this
// language's.
//
// Two route manifests matter, not one. The language's home document names the manifest
// its prerendered pages load from. A page with no prerendered document — every piece, and
// any page opened with no network — renders into the SPA fallback shell, which is the root
// build's and names the root build's manifest, whose chunks hash differently. A list with
// only the language's chunks left the settings page loading fine online and failing
// offline, because offline it came through the fallback.
export function offlineList(locale, out = OUT) {
    const home = readFileSync(`${out}/${locale}/index.html`, "utf8");
    if (!routeManifestOf(home)) {
        throw new Error(`${out}/${locale}/index.html names no route manifest`);
    }
    const urls = new Set(shellAssets(out));
    for (const doc of [home, ...optionalDocs(out, ["index.html", "__spa-fallback.html"])]) {
        const manifest = routeManifestOf(doc);
        if (!manifest) {
            continue;
        }
        urls.add(manifest);
        const routes = readFileSync(`${out}${manifest}`, "utf8");
        for (const match of routes.matchAll(/\/assets\/[A-Za-z0-9._-]+\.(?:js|css)/g)) {
            urls.add(match[0]);
        }
    }
    for (const doc of ["/", "/__spa-fallback.html", "/offline.html", `/${locale}/`]) {
        urls.add(doc);
    }
    for (const data of [
        "/songs/manifest.json",
        "/songs/builtin-assignments.json",
        "/exercises/manifest.json",
    ]) {
        urls.add(data);
    }
    for (const slice of readdirSync(`${out}/songs/index`)) {
        urls.add(`/songs/index/${slice}`);
    }
    let pictures = [];
    try {
        pictures = readdirSync(`${out}/help/${locale}`);
    } catch {
        // a language with no pictures yet has nothing to keep
    }
    for (const picture of pictures) {
        urls.add(`/help/${locale}/${picture}`);
    }
    return [...urls].sort();
}

// One list per language the build holds. A pinned build has one language's pages and
// a root-only build none, so a language with no home document here is not an error;
// the merged deploy holds all of them and writes all of them.
function routeManifestOf(html) {
    return html.match(/\/assets\/manifest-[A-Za-z0-9]+\.js/)?.[0] ?? null;
}

function optionalDocs(out, names) {
    const docs = [];
    for (const name of names) {
        try {
            docs.push(readFileSync(`${out}/${name}`, "utf8"));
        } catch {
            // a per-locale build emits neither "/" nor the fallback
        }
    }
    return docs;
}

export function writeOfflineLists(locales, out = OUT) {
    mkdirSync(`${out}/offline`, { recursive: true });
    const counts = {};
    for (const locale of locales) {
        if (!existsSync(`${out}/${locale}/index.html`)) {
            continue;
        }
        const list = offlineList(locale, out);
        writeFileSync(`${out}/offline/${locale}.json`, `${JSON.stringify(list)}\n`);
        counts[locale] = list.length;
    }
    return counts;
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
    const lists = writeOfflineLists(locales);
    const sizes = Object.values(lists);
    const kept =
        sizes.length === 0
            ? "no language's pages to keep"
            : `keep-offline lists for ${sizes.length} languages of ${Math.min(...sizes)}–${Math.max(...sizes)} URLs`;
    console.log(
        `Stamped service worker cache: plinky-${hash} (${precache.length} shell assets); ` +
            `offline page in ${Object.keys(copy).length} languages; ${kept}`,
    );
}
