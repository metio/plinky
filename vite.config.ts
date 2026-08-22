// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

// Vite resolves tsconfig `paths` natively, so no separate plugin is needed.
export default defineConfig({
    plugins: [tailwindcss(), reactRouter()],
    resolve: { tsconfigPaths: true },
    // Target only modern evergreen browsers, so the latest JS syntax ships as
    // written instead of being down-levelled. The CSS counterpart lives in
    // .browserslistrc, which Lightning CSS reads.
    build: { target: "esnext" },
    // The optional local PDMX corpus (the gitignored input to dev/import-pdmx.mts)
    // holds ~225k files — far past the OS file-watcher limit. It is never imported
    // or served, so keep the watcher off it.
    //
    // PLINKY_NO_WATCH turns the watcher off altogether, for the tooling that wants this
    // server only as a way to hand compiled modules to a browser: the promo renders take an
    // hour, and an edit anywhere in the tree during that hour would otherwise reload the
    // page out from under whatever frame was being drawn. Nothing is being developed while
    // a render runs, so there is nothing for a watcher to notice.
    server: {
        watch: process.env.PLINKY_NO_WATCH ? null : { ignored: ["**/pdmx/**"] },
    },
});
