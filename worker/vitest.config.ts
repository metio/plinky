// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

// The worker owns its test config rather than joining the root one. Two reasons, and
// the second is the one that bites: a root project and a `cd worker && npm test`
// wrapper are mutually exclusive, and the root config's coverage ratchet measures
// `app/**` and `core/**` against thresholds a new directory would move.
//
// Handlers run in workerd — the runtime that serves them — rather than in Node with a
// Request shim. A `Response` only Node accepts is a response no visitor gets.
export default defineConfig({
    plugins: [cloudflareTest({ wrangler: { configPath: "./wrangler.toml" } })],
});
