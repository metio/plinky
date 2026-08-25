// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { localizeHref } from "../../paraglide/runtime.js";
import { localizedHref } from "./href";

describe("localizedHref", () => {
    it("adds the locale prefix paraglide resolves, plus the trailing slash", () => {
        expect(localizedHref("/daily")).toBe(`${localizeHref("/daily")}/`);
    });

    it("honours an explicit locale", () => {
        expect(localizedHref("/impressum", { locale: "de" })).toBe("/de/impressum/");
    });

    it("keeps a query after the slash, so the link needs no redirect", () => {
        expect(localizedHref("/music?tab=manage")).toBe(`${localizeHref("/music")}/?tab=manage`);
    });

    it("leaves the locale root alone", () => {
        expect(localizedHref("/")).toBe(localizeHref("/"));
        expect(localizedHref("/")).toMatch(/\/$/);
    });
});

describe("a link to a place on a page", () => {
    it("keeps the hash after the slash, not before it", () => {
        // The front page sends a reader to one setting rather than to the top of a long
        // page. The slash has to land on the path — "/en/settings/#hand" — because
        // "/en/settings#hand/" is a hash nothing on the page answers to.
        expect(localizedHref("/settings#hand")).toBe("/en/settings/#hand");
        expect(localizedHref("/settings#midi")).toBe("/en/settings/#midi");
    });

    it("leaves a plain path exactly as it was", () => {
        expect(localizedHref("/settings")).toBe("/en/settings/");
    });
});
