// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CHANNELS, FOLLOW_US } from "./social";

describe("the channels Plinky is followed on", () => {
    it("is named once and read everywhere", () => {
        expect(CHANNELS.map((channel) => channel.brand)).toEqual([
            "instagram",
            "facebook",
            "youtube",
            "reddit",
            "github",
        ]);
    });

    it("links every profile by a path rather than a query", () => {
        // What a link-enricher recognises as a profile. Facebook's profile.php?id=… is the
        // same page by a URL that reads as a script call, and YouTube rendered it as bare
        // text beside two channels that got their icons.
        for (const channel of CHANNELS) {
            expect(channel.href, `${channel.label} should have no query string`).not.toContain("?");
            expect(channel.href).toMatch(/^https:\/\//);
        }
    });

    it("offers a post the three places to follow, and not the two it is already on", () => {
        expect(FOLLOW_US.map((channel) => channel.label)).toEqual([
            "Instagram",
            "Facebook",
            "Reddit",
        ]);
    });

    it("is the same set the README tells a reader", () => {
        // The README is prose and cannot import this. It carried the old Facebook URL for
        // as long as the footer did, which is what a second copy does.
        const readme = readFileSync("README.md", "utf8");
        for (const channel of CHANNELS) {
            expect(readme, `README should link ${channel.label} as ${channel.href}`).toContain(
                channel.href,
            );
        }
    });
});
