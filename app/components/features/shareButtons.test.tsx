// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { m } from "../../paraglide/messages.js";
import { ShareButtons } from "./shareButtons";

// A minimal valid SVG so the rasterise path has something to decode.
const SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"></svg>';

const mount = () => render(<ShareButtons text="I hit Grade 3" imageSvg={SVG} imageText="boast" />);

beforeEach(() => {
    URL.createObjectURL = vi.fn(() => "blob:card");
    URL.revokeObjectURL = vi.fn();
});

afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    // Tests toggle Web Share support; leave no capability behind for the next one.
    delete (navigator as { share?: unknown }).share;
    delete (navigator as { canShare?: unknown }).canShare;
});

describe("ShareButtons", () => {
    it("copies the boast and confirms only once the write lands", async () => {
        const writeText = vi.fn().mockResolvedValue(undefined);
        Object.defineProperty(navigator, "clipboard", {
            value: { writeText },
            configurable: true,
        });
        mount();

        fireEvent.click(screen.getByRole("button", { name: m.share_copy() }));
        expect(writeText).toHaveBeenCalledWith("I hit Grade 3");
        expect(await screen.findByText(m.share_copied())).toBeTruthy();
    });

    it("does not claim a copy when the clipboard write is refused", async () => {
        const writeText = vi.fn().mockRejectedValue(new Error("denied"));
        Object.defineProperty(navigator, "clipboard", {
            value: { writeText },
            configurable: true,
        });
        mount();

        fireEvent.click(screen.getByRole("button", { name: m.share_copy() }));
        await waitFor(() => expect(writeText).toHaveBeenCalled());
        expect(screen.queryByText(m.share_copied())).toBeNull();
    });

    it("prefills each platform's composer with the encoded boast", () => {
        mount();
        const x = screen.getByRole("link", { name: m.share_on({ platform: "X" }) });
        expect(x.getAttribute("href")).toBe("https://x.com/intent/post?text=I%20hit%20Grade%203");
        // Facebook shares the site URL and carries the text as the quote.
        const facebook = screen.getByRole("link", { name: m.share_on({ platform: "Facebook" }) });
        expect(facebook.getAttribute("href")).toContain("sharer.php?u=");
        expect(facebook.getAttribute("href")).toContain("quote=I%20hit%20Grade%203");
    });

    it("reads 'Save image' without Web Share and switches to 'Share' with it", async () => {
        const { unmount } = mount();
        expect(screen.getByRole("button", { name: m.share_image() })).toBeTruthy();
        unmount();

        Object.defineProperty(navigator, "share", {
            value: vi.fn(),
            configurable: true,
            writable: true,
        });
        Object.defineProperty(navigator, "canShare", {
            value: vi.fn(() => true),
            configurable: true,
            writable: true,
        });
        mount();
        expect(await screen.findByRole("button", { name: m.share_share() })).toBeTruthy();
    });

    it("opens Instagram alongside the image save when files can't be shared", () => {
        const open = vi.spyOn(window, "open").mockReturnValue(null);
        mount();

        fireEvent.click(
            screen.getByRole("button", { name: m.share_on({ platform: "Instagram" }) }),
        );
        expect(open).toHaveBeenCalledWith("https://www.instagram.com/", "_blank", "noreferrer");
    });
});
