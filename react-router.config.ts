// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { Config } from "@react-router/dev/config";

export default {
    // SPA mode: no server, hydrated on the client.
    ssr: false,
    // Prerender the static routes to their own HTML so each carries its own title
    // and social-card metadata for crawlers and link unfurlers that do not run
    // JavaScript. Dynamic per-exercise routes fall back to the SPA shell.
    prerender: [
        "/",
        "/sprint",
        "/daily",
        "/ear",
        "/songs",
        "/scores",
        "/curriculums",
        "/tracks",
        "/progress",
        "/settings",
        "/import",
    ],
} satisfies Config;
