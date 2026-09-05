// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import { cleanup, render } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useScrollToHash } from "./useScrollToHash";

function Page() {
    useScrollToHash();
    return (
        <div>
            <section id="play">play</section>
            <section id="lights">lights</section>
        </div>
    );
}

afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
});

describe("useScrollToHash", () => {
    it("scrolls the section the address names into view", () => {
        const scrolled = vi.fn();
        Element.prototype.scrollIntoView = scrolled;
        render(
            <MemoryRouter initialEntries={["/help#lights"]}>
                <Page />
            </MemoryRouter>,
        );
        expect(scrolled).toHaveBeenCalledTimes(1);
        expect((scrolled.mock.instances[0] as Element).id).toBe("lights");
    });

    it("leaves the page alone without a hash, or with one naming nothing", () => {
        const scrolled = vi.fn();
        Element.prototype.scrollIntoView = scrolled;
        render(
            <MemoryRouter initialEntries={["/help", "/help#nowhere"]} initialIndex={1}>
                <Page />
            </MemoryRouter>,
        );
        expect(scrolled).not.toHaveBeenCalled();
    });
});
