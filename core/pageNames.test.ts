// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { PAGE_NAMES, unlocalizedPath } from "./pageNames";

describe("unlocalizedPath", () => {
    it("keeps a page's sub-path whole when the sub-path is itself a page name", () => {
        expect(unlocalizedPath("/glossary/piano/")).toBe("/glossary/piano/");
        expect(unlocalizedPath("/glossary/compose/")).toBe("/glossary/compose/");
        expect(unlocalizedPath("/glossary/piano")).toBe("/glossary/piano");
        expect(unlocalizedPath("/play/piano/")).toBe("/play/piano/");
    });

    it("keeps any deeper address that starts with a page name", () => {
        expect(unlocalizedPath("/theory/major/")).toBe("/theory/major/");
        expect(unlocalizedPath("/music/grade/3/")).toBe("/music/grade/3/");
        expect(unlocalizedPath("/person/bach/")).toBe("/person/bach/");
    });

    it("keeps a lone segment, page or not, with or without its slash", () => {
        for (const path of ["/music", "/music/", "/piano/", "/zz", "/zz/"]) {
            expect(unlocalizedPath(path)).toBe(path);
        }
    });

    it("drops a mistyped language in front of a page", () => {
        expect(unlocalizedPath("/zz/play/abc")).toBe("/play/abc");
        expect(unlocalizedPath("/zz/play/abc/")).toBe("/play/abc/");
        expect(unlocalizedPath("/zz/piano/")).toBe("/piano/");
        expect(unlocalizedPath("/english/glossary/piano/")).toBe("/glossary/piano/");
    });

    it("reads a page name only as a whole segment", () => {
        expect(unlocalizedPath("/pianos/compose/")).toBe("/compose/");
        expect(unlocalizedPath("/Music/piano/")).toBe("/piano/");
    });

    it("names no language as a page", () => {
        for (const locale of ["en", "de", "fr", "ja", "zh"]) {
            expect(PAGE_NAMES.has(locale)).toBe(false);
        }
    });
});
