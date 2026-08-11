// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ToggleIconButton } from "./toggleIconButton";

afterEach(cleanup);

describe("ToggleIconButton", () => {
    it("announces its pressed state and shows the accent only while on", () => {
        const { rerender } = render(
            <ToggleIconButton pressed={false} label="Finger numbers" onClick={() => {}}>
                <svg role="presentation" />
            </ToggleIconButton>,
        );
        const button = screen.getByRole("button", { name: "Finger numbers" });
        // Membership, not substring: the quiet variant already carries
        // `text-accent-strong`, which contains `text-accent`.
        const classes = () => button.className.split(/\s+/);
        expect(button.getAttribute("aria-pressed")).toBe("false");
        expect(classes()).not.toContain("text-accent");

        rerender(
            <ToggleIconButton pressed label="Finger numbers" onClick={() => {}}>
                <svg role="presentation" />
            </ToggleIconButton>,
        );
        expect(button.getAttribute("aria-pressed")).toBe("true");
        expect(classes()).toContain("text-accent");
    });

    it("reports clicks", () => {
        const onClick = vi.fn();
        render(
            <ToggleIconButton pressed={false} label="Follow the note" onClick={onClick}>
                <svg role="presentation" />
            </ToggleIconButton>,
        );
        fireEvent.click(screen.getByRole("button", { name: "Follow the note" }));
        expect(onClick).toHaveBeenCalledTimes(1);
    });
});
