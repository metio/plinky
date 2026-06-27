// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

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
    server: { watch: { ignored: ["**/pdmx/**"] } },
});
