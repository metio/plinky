// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { unlocalizedPath } from "./unlocalizedPath";

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
        for (const path of ["/music", "/music/", "/piano/", "/zz", "/zz/", "/de"]) {
            expect(unlocalizedPath(path)).toBe(path);
        }
    });

    it("drops a mistyped language in front of a page", () => {
        expect(unlocalizedPath("/zz/play/abc")).toBe("/play/abc");
        expect(unlocalizedPath("/zz/play/abc/")).toBe("/play/abc/");
        expect(unlocalizedPath("/zz/piano/")).toBe("/piano/");
        expect(unlocalizedPath("/zz/glossary/piano/")).toBe("/glossary/piano/");
    });

    it("drops a language written with a region, a script or capitals", () => {
        expect(unlocalizedPath("/DE/music/")).toBe("/music/");
        expect(unlocalizedPath("/en-US/music/")).toBe("/music/");
        expect(unlocalizedPath("/pt_BR/play/abc")).toBe("/play/abc");
        expect(unlocalizedPath("/sr-Latn/theory/")).toBe("/theory/");
    });

    it("keeps a first segment that is not written like a language", () => {
        expect(unlocalizedPath("/english/glossary/piano/")).toBe("/english/glossary/piano/");
        expect(unlocalizedPath("/pianos/compose/")).toBe("/pianos/compose/");
        expect(unlocalizedPath("/Music/piano/")).toBe("/Music/piano/");
        expect(unlocalizedPath("/e/piano/")).toBe("/e/piano/");
        expect(unlocalizedPath("/en-/piano/")).toBe("/en-/piano/");
    });
});
