// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Answer a real page with a real status.
//
// Cloudflare Pages has one response for a path it holds no document for: it serves
// 404.html, and it serves it with a 404 status. The deploy makes 404.html the SPA shell,
// so a reader following a link to a piece gets the piece — the client router matches the
// route and renders it. A crawler gets "gone" and leaves.
//
// Almost the whole catalogue is in that position. Two pieces prerender to their own
// document (the bundled scores); the other 3,144 render on the client, in each of 26
// languages, and every one of those URLs is linked from the catalogue page. So the site
// offers a crawler roughly eighty thousand links that all answer 404 while a reader sees
// the page load perfectly — which is also why a shared link never unfurls a preview card.
//
// The document is missing. The page is not, and the status has to say which — and only
// where the page really is there. An id from a scheme the catalogue left behind, a
// composer whose spelling was merged into another's, a piece that never existed: those
// are absent, and a 200 with an empty shell for them is a soft 404 that teaches a search
// index to distrust every answer the site gives. The build writes the addresses that do
// exist to /known.json (dev/gen-known-ids.mts); a miss that is not on it keeps its 404.
//
// Middleware runs in front of the static files, so a prerendered document is served
// exactly as it is and only a miss reaches the rewrite. _routes.json narrows this to the
// routes that render from data, so a missing image stays missing: a 404 for something
// that really is absent is the correct answer and must survive.

// A generated exercise — a scale, an arpeggio, a chord set — is built from its id and has
// no manifest row to look up; its shape is the whole test.
const GENERATED = /^(?:scale|arpeggio|chords)-/;
// One fetch of the list per isolate, shared by every request it serves after.
let knownPromise = null;

// The language a visitor asked for, from the Accept-Language header, among those the site
// speaks: the first listed preference whose language tag matches, region ignored, so
// de-AT is German and zh-TW is Chinese. English when nothing matches or nothing is sent,
// which is also what a crawler gets — and English is the site's own language, the one
// every page names as its default alternate.
export function pickLocale(acceptLanguage, locales) {
    const wanted = (acceptLanguage ?? "")
        .split(",")
        .map((part) => {
            const [tag, ...params] = part.trim().split(";");
            const q = params.map((param) => param.trim()).find((param) => param.startsWith("q="));
            return { tag: (tag ?? "").toLowerCase(), q: q ? Number(q.slice(2)) : 1 };
        })
        .filter((one) => one.tag !== "" && one.tag !== "*" && one.q > 0)
        .sort((a, b) => b.q - a.q);
    for (const { tag } of wanted) {
        const language = tag.split("-")[0];
        if (locales.includes(language)) {
            return language;
        }
    }
    return "en";
}

async function known(context) {
    if (knownPromise === null) {
        knownPromise = context.env.ASSETS.fetch(new URL("/known.json", context.request.url))
            .then((response) => (response.ok ? response.json() : null))
            .then((list) =>
                list
                    ? {
                          pieces: new Set(list.pieces),
                          people: new Set(list.people),
                          locales: Array.isArray(list.locales) ? list.locales : [],
                      }
                    : null,
            )
            .catch(() => null);
    }
    return knownPromise;
}

// Whether the address names a page the site has. Unknown when the list could not be
// read: then every page is presumed real, as it always was, rather than the whole
// catalogue going missing because one file did.
export async function exists(context) {
    const path = new URL(context.request.url).pathname;
    const match = path.match(/^\/[a-z]{2}\/(play|person)\/([^/]+)\/?$/);
    if (!match) {
        return true;
    }
    const [, kind, raw] = match;
    const id = decodeURIComponent(raw);
    if (kind === "play" && GENERATED.test(id)) {
        return true;
    }
    const list = await known(context);
    if (list === null) {
        return true;
    }
    return kind === "play" ? list.pieces.has(id) : list.people.has(id);
}

export async function onRequest(context) {
    const url = new URL(context.request.url);
    // The bare root has no page of its own: it names the language pages, and a visitor
    // belongs on theirs. Sent there at the edge, so a crawler follows a redirect to a real
    // page instead of reading a shell whose only content is the script that would have
    // sent a browser on. The answer depends on the header, so it is a 302 and says so.
    if (url.pathname === "/") {
        const list = await known(context);
        if (list !== null && list.locales.length > 0) {
            const locale = pickLocale(context.request.headers.get("accept-language"), list.locales);
            return new Response(null, {
                status: 302,
                headers: { location: `${url.origin}/${locale}/`, vary: "Accept-Language" },
            });
        }
    }
    const response = await context.next();
    if (response.status !== 404) {
        return response;
    }
    if (!(await exists(context))) {
        return response;
    }
    // The body is already right — 404.html is the shell. Only the status is wrong, and a
    // Response's headers are immutable once it exists, so this rebuilds rather than edits.
    return new Response(response.body, {
        status: 200,
        statusText: "OK",
        headers: response.headers,
    });
}

// For the test alone: the list is read once per isolate, and a test needs a fresh read.
export function forgetKnown() {
    knownPromise = null;
}
