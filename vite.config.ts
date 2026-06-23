// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

// Vite resolves tsconfig `paths` natively, so no separate plugin is needed.
export default defineConfig({
    plugins: [tailwindcss(), reactRouter()],
    resolve: { tsconfigPaths: true },
});
