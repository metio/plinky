// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import { meta } from "./stats";

describe("Stats meta", () => {
    it("keeps the personal progress page out of the search index", () => {
        const tags = meta({} as Parameters<typeof meta>[0]) as Record<string, string>[];
        expect(tags).toContainEqual({ name: "robots", content: "noindex, follow" });
    });
});
