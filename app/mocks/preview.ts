// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// Preview-deploy mocks ("plinky-preview-mocks"): the per-branch Cloudflare
// previews run on origins Sanity's CORS allowlist doesn't know, so the live
// content API is unreachable there — the news banner, help page and board
// would all render empty on exactly the builds meant for reviewing them.
// When a build carries VITE_PREVIEW_MOCKS=1, this Mock Service Worker answers
// every Sanity query with stable demo content instead. Production builds never
// set the flag, so the whole module is dead code there (the bundle gate
// forbids the marker above from ever reaching a production chunk).

import { http, HttpResponse } from "msw";
import { setupWorker } from "msw/browser";

// A real, public image from the live project's CDN — <img> loads aren't
// subject to the CORS allowlist, only API queries are.
const IMAGE =
    "https://cdn.sanity.io/images/susa35pw/production/f55b0bb7fc3d52639ab8034f23b5883d11445afd-150x150.jpg";

const NEWS = {
    enabled: true,
    item: {
        id: "preview-news",
        imageUrl: IMAGE,
        imageAlt: "Preview banner",
        linkUrl: "https://plinky.fun/en/library",
        headline: "Preview build — this banner is demo content",
    },
};

const BOARD = [
    {
        id: "preview-artist-1",
        name: "Ada Keys",
        order: 1,
        text: "Demo artist for preview builds — nocturnes at dawn, études at dusk.",
        imageUrl: IMAGE,
        imageAlt: "Ada at the piano",
        linkUrl: "https://www.instagram.com/plinky.piano",
    },
    {
        id: "preview-artist-2",
        name: "Ben Pedal",
        order: 2,
        text: "One tiny étude a week, every week — demo content, not a real pin.",
        linkUrl: "https://www.youtube.com/@plinky",
    },
];

const HELP_PAGES = [
    "gettingStarted",
    "home",
    "play",
    "library",
    "daily",
    "compose",
    "assignments",
    "you",
    "review",
    "settings",
];

const HELP = HELP_PAGES.map((pageKey, index) => ({
    id: `preview-help-${pageKey}`,
    pageKey,
    order: index,
    imageUrl: index === 0 ? IMAGE : undefined,
    imageAlt: "",
    text: `Demo help for the ${pageKey} page. This block is preview-build content served by the mock — the live page reads the real words from Sanity.`,
}));

// One handler covers every query to the project's API CDN; the GROQ arrives as
// a query parameter, so the document type in it picks the canned answer.
export async function startPreviewMocks(): Promise<void> {
    const worker = setupWorker(
        http.get("https://*.apicdn.sanity.io/*", ({ request }) => {
            const query = new URL(request.url).searchParams.get("query") ?? "";
            if (query.includes("boardArtist")) {
                return HttpResponse.json({ result: BOARD });
            }
            if (query.includes("helpItem")) {
                return HttpResponse.json({ result: HELP });
            }
            return HttpResponse.json({ result: NEWS });
        }),
    );
    await worker.start({ onUnhandledRequest: "bypass", quiet: true });
    // The marker the production bundle gate greps for — a preview-only string
    // that must never appear in a real build's chunks.
    console.info("plinky-preview-mocks active: Sanity content is demo data");
}
