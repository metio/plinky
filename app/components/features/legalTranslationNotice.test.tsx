// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { m } from "../../paraglide/messages.js";
import { baseLocale, overwriteGetLocale } from "../../paraglide/runtime.js";
import { LegalTranslationNotice } from "./legalTranslationNotice";

// The shared setup pins getLocale to the base locale (en); a test that needs the
// German branch flips it and restores afterwards.
afterEach(() => {
    overwriteGetLocale(() => baseLocale);
    cleanup();
});

describe("LegalTranslationNotice", () => {
    it("shows the machine-translation notice and links to the German original on a translated locale", () => {
        render(<LegalTranslationNotice page="datenschutz" />);
        expect(screen.getByRole("note").textContent).toContain(m.legal_mt_notice_body());
        const link = screen.getByRole("link", { name: m.legal_mt_view_original() });
        expect(link.getAttribute("href")).toBe("/de/datenschutz");
    });

    it("renders nothing on the German page, where there is nothing to disclaim", () => {
        overwriteGetLocale(() => "de");
        const { container } = render(<LegalTranslationNotice page="impressum" />);
        expect(container.firstChild).toBeNull();
    });
});
