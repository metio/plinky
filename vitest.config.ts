// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { defineConfig } from "vitest/config";

// Deliberately separate from vite.config.ts: the React Router plugin there is
// incompatible with the test runner. Logic tests run in a plain node env.
export default defineConfig({
    test: {
        environment: "node",
        include: ["app/**/*.test.ts"],
        coverage: {
            provider: "v8",
            include: ["app/**/*.{ts,tsx}"],
            reporter: ["text", "html", "lcov"],
        },
    },
});
