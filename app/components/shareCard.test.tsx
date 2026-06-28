// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { Grid } from "../lib/shareCard";
import { ShareCard } from "./shareCard";

afterEach(cleanup);

const GRID: Grid = [
    ["best", "good", "ok"],
    ["good", "best", "weak"],
    ["none", "ok", "best"],
];

function renderCard() {
    return render(
        <ShareCard
            grid={GRID}
            caption="Share your run"
            gridLabel="grid"
            rowLabels={["Accuracy", "Timing", "Flow"]}
            boast="My run 🎹"
            heading="Plinky"
        />,
    );
}

describe("ShareCard share links", () => {
    it("links to each platform's composer with the boast text prefilled", () => {
        renderCard();
        const encoded = encodeURIComponent("My run 🎹");
        const hosts = {
            X: "x.com/intent/post",
            Bluesky: "bsky.app/intent/compose",
            Threads: "threads.net/intent/post",
            WhatsApp: "wa.me",
        };
        for (const [platform, host] of Object.entries(hosts)) {
            const link = screen.getByRole("link", { name: `Share on ${platform}` });
            expect(link.getAttribute("href")).toContain(host);
            expect(link.getAttribute("href")).toContain(encoded);
        }
    });

    it("names the icon-only links for assistive tech", () => {
        renderCard();
        // The glyph itself is decorative; the link carries the accessible name.
        const link = screen.getByRole("link", { name: "Share on X" });
        expect(link.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
    });
});
