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
});
