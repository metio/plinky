// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import { loadBundledScores } from "../lib/catalog";
import { m } from "../paraglide/messages.js";
import { meta } from "./play";

type MetaTag = Record<string, unknown>;

describe("Play meta", () => {
    it("emits a breadcrumb trail from Home to the piece for a bundled score", () => {
        const score = loadBundledScores()[0]!;
        const tags = meta({
            params: { scoreId: score.id },
        } as Parameters<typeof meta>[0]) as MetaTag[];
        const breadcrumb = tags
            .map(
                (tag) => tag["script:ld+json"] as { "@type"?: string; itemListElement?: unknown[] },
            )
            .find((data) => data?.["@type"] === "BreadcrumbList");
        expect(breadcrumb).toBeTruthy();
        const items = breadcrumb!.itemListElement as { name: string }[];
        expect(items[0]?.name).toBe(m.nav_home());
        expect(items.at(-1)?.name).toBe(score.title);
    });
});
