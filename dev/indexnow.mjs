// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Which addresses a deploy should tell the search engines about, and the telling.
//
// A sitemap says "here is everything"; a crawler reads it when it next feels like it, and
// for a site that deploys several times a day that is most of the change gone unnoticed.
// IndexNow is the other direction — the site says "these addresses changed" and Bing,
// Yandex and Seznam fetch them, usually within the hour. Google does not participate;
// its own answer is the sitemap, which is why both exist here rather than one.
//
// The protocol's one rule worth respecting is not to submit what did not change: an
// endpoint fed the whole site on every push is an endpoint that learns to ignore the
// site. So the URL set is derived from the push's own diff, and a push that changed
// nothing a reader can see submits nothing at all.
//
// This file is the pure half. dev/submit-indexnow.mjs reads git and does the posting.

// A search engine takes at most ten thousand URLs in one submission.
export const MAX_URLS = 10_000;

// The key is public by design: it is served at /<key>.txt, and fetching that file is how
// an engine checks that whoever submitted the URLs controls the site.
export const INDEXNOW_KEY = "f20affed073f07eb6d5c409f78c1ee70";

// One endpoint is enough. The engines that take part share submissions with each other,
// which is the protocol's own arrangement rather than a hope about it.
export const INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow";

const localeUrls = (siteUrl, locales, path) =>
    locales.map((locale) => `${siteUrl}/${locale}${path}`);

// The pages a set of changed files changes, as URLs.
//
//   changed   — the push's file paths, as git names them.
//   pages     — every static page, canonical path and route module (dev/pages.mjs).
//   pieces    — the ids the catalogue gained or whose row was rewritten.
//   locales   — every language the site speaks.
//
// The mapping is deliberately narrow. A shared component or a store changing rewrites no
// page's content, and submitting the whole site because a hook moved is exactly the noise
// the protocol asks not to send. What does map: a route's own module, a language's
// messages, and the catalogue rows behind the piece pages.
export function changedUrls({ changed, pages, pieces = [], locales, siteUrl }) {
    const urls = new Set();
    const byModule = new Map(pages.map((page) => [page.module, page.path]));

    for (const file of changed) {
        const page = byModule.get(file.startsWith("app/") ? file.slice("app/".length) : file);
        if (page !== undefined) {
            for (const url of localeUrls(siteUrl, locales, page === "/" ? "/" : `${page}/`)) {
                urls.add(url);
            }
            continue;
        }
        // A language's own strings: every page in that language says something new, and
        // no page in any other does.
        const messages = file.match(/^messages\/([a-z]{2})\.json$/);
        if (messages && locales.includes(messages[1])) {
            for (const { path } of pages) {
                urls.add(`${siteUrl}/${messages[1]}${path === "/" ? "/" : `${path}/`}`);
            }
        }
    }

    for (const id of pieces) {
        for (const url of localeUrls(siteUrl, locales, `/play/${encodeURIComponent(id)}/`)) {
            urls.add(url);
        }
    }
    return [...urls];
}

// The ids a catalogue change added or rewrote. A row whose title, composer or grade moved
// is a piece page that now says something different; a row that is byte-identical is not.
export function changedPieces(before, after) {
    const was = new Map((before ?? []).map((row) => [row.id, JSON.stringify(row)]));
    return (after ?? [])
        .filter((row) => was.get(row.id) !== JSON.stringify(row))
        .map((row) => row.id);
}

// The submissions to make: one per batch of at most ten thousand URLs, in the JSON body
// the protocol defines. An empty set makes no submission rather than an empty one.
export function submissions(urls, { host, key = INDEXNOW_KEY }) {
    const batches = [];
    for (let at = 0; at < urls.length; at += MAX_URLS) {
        batches.push({
            host,
            key,
            keyLocation: `https://${host}/${key}.txt`,
            urlList: urls.slice(at, at + MAX_URLS),
        });
    }
    return batches;
}
