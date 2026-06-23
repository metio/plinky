// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { defineConfig } from "vitest/config";

// Deliberately separate from vite.config.ts: the React Router plugin there is
// incompatible with the test runner. Logic tests run in a plain node env.
export default defineConfig({
    test: {
        environment: "node",
        // Logic tests run in node; component tests opt into jsdom with a
        // `// @vitest-environment jsdom` docblock.
        include: ["app/**/*.test.{ts,tsx}"],
        coverage: {
            provider: "v8",
            include: ["app/**/*.{ts,tsx}"],
            reporter: ["text", "html", "lcov"],
        },
    },
});
