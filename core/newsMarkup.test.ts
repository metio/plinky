// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { inlineParts, paragraphs } from "./newsMarkup";

describe("the little markup an entry is written in", () => {
    it("keeps plain prose as one piece", () => {
        expect(inlineParts("nothing to mark up here")).toEqual([
            { kind: "text", text: "nothing to mark up here" },
        ]);
    });

    it("reads the bold lead an entry opens with", () => {
        expect(inlineParts("**The board is gone**, and so is the banner.")).toEqual([
            { kind: "bold", text: "The board is gone" },
            { kind: "text", text: ", and so is the banner." },
        ]);
    });

    it("reads a link, and code", () => {
        expect(inlineParts("see [the notes](https://plinky.fun/en/) or `npm run news`")).toEqual([
            { kind: "text", text: "see " },
            { kind: "link", text: "the notes", href: "https://plinky.fun/en/" },
            { kind: "text", text: " or " },
            { kind: "code", text: "npm run news" },
        ]);
    });

    it("renders a link a browser must not follow as the characters it is", () => {
        // An entry is a file in the repository, and a page that turns any href into a
        // link runs whatever the href says the day somebody pastes one in.
        expect(inlineParts("[tap](javascript:alert(1))")).toEqual([
            { kind: "text", text: "[tap](javascript:alert(1))" },
        ]);
        expect(inlineParts("[tap](data:text/html,x)")).toEqual([
            { kind: "text", text: "[tap](data:text/html,x)" },
        ]);
    });

    it("takes a site-relative link and a mail address", () => {
        expect(inlineParts("[music](/en/music/)")).toEqual([
            { kind: "link", text: "music", href: "/en/music/" },
        ]);
        expect(inlineParts("[write](mailto:hi@example.com)")).toEqual([
            { kind: "link", text: "write", href: "mailto:hi@example.com" },
        ]);
    });

    it("leaves anything else as the characters it is", () => {
        // Four constructs and no more. A reader seeing the underscores is how the entry
        // gets fixed; a half-supported syntax would drop the words instead.
        expect(inlineParts("_italic_ and # heading")).toEqual([
            { kind: "text", text: "_italic_ and # heading" },
        ]);
        expect(inlineParts("2 * 3 * 4")).toEqual([{ kind: "text", text: "2 * 3 * 4" }]);
    });

    it("does not let a link's text be eaten by the bold around it", () => {
        expect(inlineParts("**a [b](https://x.test/) c**")).toEqual([
            { kind: "text", text: "**a " },
            { kind: "link", text: "b", href: "https://x.test/" },
            { kind: "text", text: " c**" },
        ]);
    });

    it("copes with nothing at all", () => {
        expect(inlineParts("")).toEqual([]);
    });
});

describe("an entry's paragraphs", () => {
    it("splits on a blank line and folds the author's wrapping away", () => {
        expect(paragraphs("**One.** A line\nwrapped by an editor.\n\nAnd another.")).toEqual([
            [
                { kind: "bold", text: "One." },
                { kind: "text", text: " A line wrapped by an editor." },
            ],
            [{ kind: "text", text: "And another." }],
        ]);
    });

    it("drops the empty blocks a trailing newline leaves", () => {
        expect(paragraphs("Only this.\n\n\n")).toEqual([[{ kind: "text", text: "Only this." }]]);
        expect(paragraphs("")).toEqual([]);
    });
});
