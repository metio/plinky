// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Drawer } from "./drawer";

afterEach(cleanup);

describe("Drawer", () => {
    it("renders nothing while closed", () => {
        render(
            <Drawer open={false} onClose={() => {}} title="Practice tools">
                <p>panel body</p>
            </Drawer>,
        );
        expect(screen.queryByRole("dialog")).toBeNull();
        expect(screen.queryByText("panel body")).toBeNull();
    });

    it("shows a labelled modal dialog with its content when open", () => {
        render(
            <Drawer open onClose={() => {}} title="Practice tools">
                <p>panel body</p>
            </Drawer>,
        );
        const dialog = screen.getByRole("dialog", { name: "Practice tools" });
        expect(dialog.getAttribute("aria-modal")).toBe("true");
        expect(screen.getByText("panel body")).toBeTruthy();
    });

    it("closes on Escape", () => {
        const onClose = vi.fn();
        render(
            <Drawer open onClose={onClose} title="Practice tools">
                <p>panel body</p>
            </Drawer>,
        );
        fireEvent.keyDown(document, { key: "Escape" });
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("closes on the backdrop and the close button", () => {
        const onClose = vi.fn();
        render(
            <Drawer open onClose={onClose} title="Practice tools">
                <p>panel body</p>
            </Drawer>,
        );
        // Both the full-bleed backdrop and the header control carry the close label.
        const closers = screen.getAllByRole("button", { name: "Close" });
        expect(closers).toHaveLength(2);
        for (const closer of closers) {
            fireEvent.click(closer);
        }
        expect(onClose).toHaveBeenCalledTimes(2);
    });

    it("keeps focus on an inside control when the parent re-renders with a fresh onClose", () => {
        // onClose is an inline arrow from the caller, so it has a new identity on every
        // parent render. The trap must not re-run and pull focus back to the dialog, or
        // keyboard use of the panel breaks during playback (a continuous re-render).
        const { rerender } = render(
            <Drawer open onClose={() => {}} title="Practice tools">
                <button type="button">a control</button>
            </Drawer>,
        );
        const control = screen.getByRole("button", { name: "a control" });
        control.focus();
        expect(document.activeElement).toBe(control);
        rerender(
            <Drawer open onClose={() => {}} title="Practice tools">
                <button type="button">a control</button>
            </Drawer>,
        );
        expect(document.activeElement).toBe(control);
    });

    it("traps the first Shift+Tab, which starts from the dialog container", () => {
        render(
            <Drawer open onClose={() => {}} title="Practice tools">
                <button type="button">first</button>
                <button type="button">last</button>
            </Drawer>,
        );
        const dialog = screen.getByRole("dialog");
        // On open focus is on the container itself — neither first nor last focusable — so a
        // naive trap lets the first Shift+Tab escape to the page behind. It must wrap to the
        // last focusable in the panel (here the body's "last" button).
        expect(document.activeElement).toBe(dialog);
        fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
        expect(document.activeElement).toBe(screen.getByRole("button", { name: "last" }));
    });

    it("still closes on Escape after the parent swaps onClose", () => {
        // The latest onClose is read through a ref, so a re-rendered handler is the one that
        // fires — not a stale closure captured when the drawer first opened.
        const onClose = vi.fn();
        const { rerender } = render(
            <Drawer open onClose={() => {}} title="Practice tools">
                <p>panel body</p>
            </Drawer>,
        );
        rerender(
            <Drawer open onClose={onClose} title="Practice tools">
                <p>panel body</p>
            </Drawer>,
        );
        fireEvent.keyDown(document, { key: "Escape" });
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("portals into the active Fullscreen element so it isn't hidden behind the score", () => {
        // The native Fullscreen API paints only the fullscreen element's subtree, so a
        // portal onto the body would render invisibly behind a full-screen score. With one
        // open, the drawer must mount inside it.
        const stage = document.createElement("div");
        document.body.appendChild(stage);
        Object.defineProperty(document, "fullscreenElement", {
            configurable: true,
            value: stage,
        });
        try {
            render(
                <Drawer open onClose={() => {}} title="Practice tools">
                    <p>panel body</p>
                </Drawer>,
            );
            const dialog = screen.getByRole("dialog", { name: "Practice tools" });
            expect(stage.contains(dialog)).toBe(true);
        } finally {
            Object.defineProperty(document, "fullscreenElement", {
                configurable: true,
                value: null,
            });
            stage.remove();
        }
    });
});
