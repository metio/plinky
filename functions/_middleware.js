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
// The document is missing. The page is not, and the status has to say which.
//
// Middleware runs in front of the static files, so a prerendered document is served
// exactly as it is and only a miss reaches the rewrite. _routes.json narrows this to the
// routes that render from data, so a missing image stays missing: a 404 for something
// that really is absent is the correct answer and must survive.
export async function onRequest(context) {
    const response = await context.next();
    if (response.status !== 404) {
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
