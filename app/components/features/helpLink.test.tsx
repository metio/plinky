// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import { HelpLink, helpAnchorFor } from "./helpLink";

afterEach(cleanup);

function LocationProbe() {
    const { pathname, hash } = useLocation();
    return <span data-testid="loc">{`${pathname}${hash}`}</span>;
}

function setScrollY(value: number) {
    Object.defineProperty(window, "scrollY", { value, configurable: true });
}

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

    it("opens help at its own top from the top of the front page", () => {
        setScrollY(0);
        render(
            <MemoryRouter initialEntries={["/en"]}>
                <HelpLink />
                <LocationProbe />
            </MemoryRouter>,
        );
        // The href still names the home section (for hover/new-tab).
        expect(screen.getByLabelText("Help").getAttribute("href")).toBe("/en/help#home");
        fireEvent.click(screen.getByLabelText("Help"));
        // But the click lands on the help top, not the skipped-past home section.
        expect(screen.getByTestId("loc").textContent).toBe("/en/help");
    });

    it("jumps to the home section once the front page is scrolled down", () => {
        setScrollY(400);
        render(
            <MemoryRouter initialEntries={["/en"]}>
                <HelpLink />
                <LocationProbe />
            </MemoryRouter>,
        );
        fireEvent.click(screen.getByLabelText("Help"));
        expect(screen.getByTestId("loc").textContent).toBe("/en/help#home");
    });
});
