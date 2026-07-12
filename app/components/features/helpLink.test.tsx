// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import { HelpLink, helpAnchorFor } from "./helpLink";

afterEach(cleanup);

describe("helpAnchorFor", () => {
    it("maps a page path (with locale prefix) to its help section key", () => {
        expect(helpAnchorFor("/en/play/abc123")).toBe("play");
        expect(helpAnchorFor("/de/library")).toBe("library");
        expect(helpAnchorFor("/en/you")).toBe("you");
        expect(helpAnchorFor("/fr")).toBe("home");
    });

    it("falls back to getting-started for an unrecognised path", () => {
        expect(helpAnchorFor("/en/something-else")).toBe("gettingStarted");
    });
});

describe("HelpLink", () => {
    it("links to the help section for the current page", () => {
        render(
            <MemoryRouter initialEntries={["/en/play/abc123"]}>
                <HelpLink />
            </MemoryRouter>,
        );
        const link = screen.getByLabelText("Help");
        expect(link.getAttribute("href")).toBe("/en/help#play");
    });
});
